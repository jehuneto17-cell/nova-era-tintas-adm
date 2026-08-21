# Mudança no schema de produto — campo `todasCores` (Firestore, coleção `produtos`)

## O que mudou no painel admin

Adicionei suporte a produtos que são vendidos em **qualquer cor da paleta**, sem
controlar estoque por cor individualmente (ex.: tintas onde a cor é feita na hora,
por tintometria, e o preço varia só por volume).

## Mudanças no documento `produtos/{id}` no Firestore

1. **Novo campo opcional `todasCores?: boolean`**
   - `true` → o produto está disponível em todas as cores da paleta da loja.
     Não existe controle de estoque por cor para ele.
   - `false` ou ausente (produtos antigos) → comportamento de sempre, com
     `cores: ProdutoCor[]` listando as cores específicas do produto.

2. **Quando `todasCores === true`:**
   - `cores` é salvo como array vazio (`[]`) — não usar `cores` para exibir/filtrar
     esse produto quando `todasCores` for `true`.
   - `variacoes` (o mapa `Record<string, ProdutoVariacao>`, chave `"${cor}|${volume}"`)
     passa a usar uma **chave de cor especial**: `"__todas__"`. Ou seja, as chaves
     ficam no formato `"__todas__|1Kg"`, `"__todas__|3.6L"`, etc. — uma variação por
     volume, com preço único, e `estoque` sem uso real de controle por cor.
   - `ProdutoVariacao.cor` para essas entradas também vem como a string `"__todas__"`.

3. **Schema completo do documento (TypeScript), para referência:**
   ```ts
   interface ProdutoVariacao {
     cor: string;      // nome da cor, ou "__todas__" quando todasCores=true
     volume: string;
     preco: number;
     estoque: number;
     ativo: boolean;
   }

   interface ProdutoCor {
     corId?: string;
     codigo?: string;
     nome: string;
     hex: string;
   }

   interface Produto {
     id: string;
     nome: string;
     categoriaId: string;
     categoria: string;
     descricao: string;
     limiteEstoqueBaixo: number;
     descontoPct: number;
     ativo: boolean;
     cores: ProdutoCor[];       // [] quando todasCores=true
     todasCores?: boolean;      // NOVO CAMPO
     volumes: string[];
     variacoes: Record<string, ProdutoVariacao>; // chave "cor|volume", cor pode ser "__todas__"
     specs: { nome: string; valor: string }[];
     fotos: { id: string; url: string }[];
   }
   ```

## O que precisa mudar nos outros apps (web e mobile)

Qualquer lugar que leia `produto.cores` ou monte a lista de cores disponíveis a
partir das chaves de `variacoes` precisa checar `produto.todasCores` primeiro:

- **Se `todasCores === true`:**
  - Não usar `produto.cores` (estará vazio).
  - Exibir a paleta de cores **global** da loja (coleção `cores` do Firestore, já
    usada em outras telas) como as opções selecionáveis para esse produto, em vez
    das cores específicas do produto.
  - Ao montar o preço/estoque, ignorar a parte "cor" da chave de `variacoes` —
    buscar direto pela chave `"__todas__|<volume escolhido>"`.
  - Não exibir contagem/aviso de estoque por cor para esse produto (o admin trata
    o estoque desses itens como não controlado por cor — hoje o painel mostra "—"
    no lugar do estoque numérico para esses produtos).

- **Se `todasCores` for `false`/ausente:** nenhuma mudança — continua tudo como
  está hoje (fluxo por `cores` + chave `"corNome|volume"`).

## Observação sobre dados existentes

Produtos antigos não têm o campo `todasCores` no documento — tratem `undefined`
como equivalente a `false`. Não é necessário migração de dados dos produtos que
já existem hoje.

---
*Gerado a partir das mudanças em `src/app/(admin)/produtos/page.tsx` e
`src/lib/types.ts` no repositório do painel admin (Nova Era Tintas).*

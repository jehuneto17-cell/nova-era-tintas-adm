# Prompt para o app da loja (web + mobile)

Cole isto no assistente que tem acesso ao código do app da loja (Nova Era Tintas), tanto na versão web quanto mobile.

---

Preciso remover TODOS os dados mockados/hardcoded do app e substituir por leitura real do Firestore. O painel administrativo (projeto separado) já está gravando dados reais nessas coleções — o app só precisa ler de lá. Não escreva nada em Firestore que não seja o que o app já faz hoje (carrinho, pedidos do cliente, etc.) — o objetivo aqui é só trocar a LEITURA de mock para Firestore real.

Projeto Firebase: `nova-era-tintas` (mesmas credenciais do `.env` do app, se já configurado; se não tiver Firebase configurado ainda, me avise antes de continuar).

## Coleções e formato exato dos documentos

### `produtos/{id}`
```ts
{
  nome: string;
  categoriaId: string;
  categoria: string;          // nome da categoria, já resolvido
  descricao: string;
  limiteEstoqueBaixo: number;
  descontoPct: number;        // percentual de desconto, 0 = sem desconto
  ativo: boolean;              // false = não deve aparecer na loja
  cores: { nome: string; hex: string }[];
  volumes: string[];           // ex: ["1L", "3,6L", "18L"]
  variacoes: {
    // chave = "NomeDaCor|Volume", ex: "Branco Neve|1L"
    [chave: string]: {
      cor: string;
      volume: string;
      preco: number;
      estoque: number;
      ativo: boolean;          // false = variação pausada, não vender
    }
  };
  specs: { nome: string; valor: string }[];
  fotos: { id: string; url: string }[];  // fotos[0] é a capa
}
```
Preço mínimo/máximo do produto = `Math.min/max` dos `preco` dentro de `variacoes`. Estoque total = soma dos `estoque` de todas as variações. Nunca mostrar/vender uma variação com `ativo: false` nem um produto com `ativo: false`.

### `categorias/{id}`
```ts
{
  nome: string;
  icone: string;       // id de um ícone lucide (roller, brush, droplet, layers, wrench, home, sparkles, sun, package, grid, tag, palette)
  fotoUrl?: string;     // imagem de capa da categoria, se enviada
  fundo: string;        // cor hex de fallback quando não tem fotoUrl
  ordem: number;        // ordem de exibição na Home — ordenar por este campo
  ativa: boolean;       // false = não mostrar na Home (mas produtos dela continuam pesquisáveis)
  qtdProdutos: number;
}
```

### `pedidos/{id}`
```ts
{
  numero: string;             // ex: "#1043"
  clienteId: string;           // aponta para clientes/{id}
  cliente: string;             // nome do cliente, já resolvido
  telefone: string;
  estado: "em_negociacao" | "aguardando_pagamento" | "aguardando_confirmacao"
        | "pago" | "separacao" | "enviado" | "entregue" | "cancelado" | "expirado";
  criadoEm: string;             // ISO string (new Date().toISOString())
  itens: { produtoId: string; nome: string; variacao: string; qtd: number; preco: number }[];
  frete: number;
  endereco: string;
  enderecoMudou: boolean;
  historico: { estado: string; quando: string; quem: string; observacao?: string }[];
  comprovanteUrl?: string;
  comprovanteEnviadoEm?: string;
  valorComprovante?: number;
}
```
O app do cliente é responsável por CRIAR o pedido nessa coleção (com `estado: "em_negociacao"` inicial) e por avançar o pedido para `"aguardando_confirmacao"` quando o cliente enviar o comprovante PIX. O painel admin lê e atualiza a partir daí.

### `clientes/{id}` (documento deve usar o mesmo `id` do usuário no Firebase Auth)
```ts
{
  nome: string;
  telefone: string;
  email: string;
  desde: string;
  enderecos: { id: string; rotulo: string; texto: string; principal: boolean }[];
  historicoEnderecos: string[];
}
```
Não existe subcoleção de pedidos aqui — para saber pedidos/histórico de compra de um cliente, consulte `pedidos` filtrando por `clienteId`.

### `configuracoes/branding` (documento único)
```ts
{
  logo_url: string | null;
  banner_url_web: string | null;      // banner do app web — só o web lê este campo
  banner_url_mobile: string | null;   // banner do app mobile — só o mobile lê este campo
  descricao: string;           // texto sobre o banner, compartilhado pelos dois
  telefone: string;
  email: string;
  redes_sociais: { instagram: string; facebook: string; tiktok: string };
}
```
O painel admin permite subir uma imagem de banner diferente para cada app. Não existe mais um campo único `banner_url` — cada app deve ler apenas o campo do seu próprio canal (`_web` ou `_mobile`) e ignorar o outro.

### `configuracoes/pagamento` (documento único)
```ts
{
  pix_tipo: string;
  pix_chave: string;
  pix_recebedor: string;
  pix_qr_url?: string;
  pix_instrucoes: string;
  pix_prazo_horas: number;
  motivos_recusa: string[];    // usado só pelo admin, ignorar no app
}
```

### `configuracoes/whatsapp` (documento único)
```ts
{ numero: string; mensagem: string }
```

### `configuracoes/frete` (documento único)
```ts
{ valor: number; gratis_acima: number }
```

### `configuracoes/buscas` (documento único)
```ts
{ termos: string[]; mostrar: boolean }
```

### `configuracoes/loja` (documento único)
```ts
{ nome: string; cnpj: string; endereco: string; cidade: string; estado: string; horarios: string }
```

### `cupons/{id}`
```ts
{
  codigo: string;
  tipo: "%" | "R$";
  valor: number;
  inicio: string;   // "YYYY-MM-DD"
  fim: string;       // "YYYY-MM-DD"
  limite: number | null;  // null = sem limite de usos
  usos: number;
  ativo: boolean;
}
```
Um cupom é válido se `ativo === true` e a data de hoje está entre `inicio` e `fim` (e `usos < limite`, se `limite` não for null).

## O que fazer

1. Encontre TODOS os lugares no app (web e mobile) que usam array/objeto mockado — produtos fixos, categorias fixas, banner/logo fixos, chave PIX fixa, motivos de recusa fixos, etc. — e liste-os antes de mexer, para eu confirmar o escopo.
2. Troque cada mock por leitura real do Firestore nas coleções acima (`onSnapshot` para listas que devem atualizar em tempo real — catálogo, categorias, config de branding/pagamento — ou `getDoc`/`getDocs` onde tempo real não for necessário).
3. Garanta que a criação de pedido (`pedidos/{id}`) e o cadastro/atualização de cliente (`clientes/{id}`) já sigam exatamente esse formato de campos, para o painel admin conseguir ler e gerenciar sem precisar de tradução.
4. Aplique os filtros de negócio: produto/variação com `ativo: false` não aparece pro cliente; categoria com `ativa: false` some da Home mas os produtos continuam buscáveis; cupom expirado ou sem `ativo` não é aceito no carrinho.
5. Não invente campos novos nem mude os nomes acima — o painel admin já está em produção lendo/gravando exatamente esses nomes de coleção e campo.
6. Ao final, rode o app e confirme visualmente que a Home carrega categorias e produtos reais (não mais o mock), que o banner/logo vêm de `configuracoes/branding`, e que a tela de pagamento mostra a chave PIX real de `configuracoes/pagamento`.

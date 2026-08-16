@AGENTS.md

# Nova Era Tintas — Painel Administrativo (adm)

Este repositório é o **painel administrativo** (web, Next.js 16 + React 19 + Firebase/Firestore) usado pela loja para gerenciar produtos, categorias, pedidos, clientes, cupons e configurações da Nova Era Tintas.

## O ecossistema tem 3 apps

O produto completo é formado por **três aplicativos separados**, mantidos por um time. Este repositório é apenas um deles:

1. **adm** (este repositório) — painel administrativo web, uso interno da loja.
2. **web** — loja virtual pública, onde o cliente final navega e compra pelo navegador.
3. **mobile** — app do cliente final em celular (Android/iOS).

Os três compartilham o mesmo banco Firestore. Antes de assumir que um dado, rota, ou comportamento "não existe", considere que ele pode estar implementado em um dos outros dois apps, fora deste repositório — não invente ou implemente por conta própria uma funcionalidade que pertence a outro app sem confirmar com o usuário primeiro.

## Como responder e agir neste projeto

- **Nunca inventar dados ou URLs.** Se um link, domínio, endpoint ou número (ex: link de acompanhamento de pedido, domínio da loja) não estiver configurado no código, dizer isso claramente em vez de simular que funciona. Ver histórico: o `{link}` do WhatsApp era um domínio placeholder (`novaeratintas.com/p/...`) que não resolvia para nenhuma página real — isso deveria ter sido sinalizado, não silenciado.
- **Confirmar domínio/infra real antes de codificar.** Links, domínios e credenciais de produção (Firebase, Cloudinary, PIX, etc.) só devem ser trocados no código quando o usuário fornecer o valor real — nunca com valor de exemplo/placeholder.
- **Este é um painel administrativo com dados sensíveis** (pedidos, clientes, valores, PIX, WhatsApp da loja). Ao editar código que lê/grava no Firestore, atenção redobrada para não expor, sobrescrever ou apagar dados de produção sem confirmação.
- **Escopo do repositório**: mudanças aqui afetam somente o adm. Se uma tarefa exigir mudança em "web" ou "mobile", isso está fora deste repositório — avisar o usuário em vez de tentar simular a mudança aqui.
- Ao sugerir textos (mensagens de WhatsApp, categorias, produtos), preferir sempre confirmar tom/conteúdo com o usuário antes de escrever, já que é conteúdo que vai para clientes reais.

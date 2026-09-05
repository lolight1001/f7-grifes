# F7 Grifes — loja + painel admin (rodando no seu PC)

Isso aqui é um site completo com backend próprio: a loja (`/`) e um painel
administrador (`/admin`) pra você adicionar, editar e ocultar produtos sem
precisar mexer em código. Roda **inteiramente no seu computador** — não é
hospedado na internet, então só funciona enquanto o servidor estiver
rodando na sua máquina, e só é acessível *nela*.

## 1. Pré-requisito: instalar o Node.js

Baixe e instale em **https://nodejs.org** (versão 18 ou mais recente — o
botão "LTS" já serve). Não precisa de mais nada: o servidor não usa
nenhuma biblioteca externa, então não tem `npm install` pra rodar.

## 2. Trocar a senha do admin (importante, faça antes de usar)

Abra o arquivo `config.json` num editor de texto e troque o valor de
`"adminPassword"` por uma senha só sua:

```json
{
  "port": 3000,
  "adminPassword": "sua-senha-aqui"
}
```

Salve o arquivo. Se o servidor já estiver rodando, precisa reiniciar
(feche e rode `node server.js` de novo) pra senha nova valer.

## 3. Rodar o servidor

**Opção mais fácil:** dê duplo clique em:
- `iniciar-windows.bat` (Windows)
- `iniciar-mac-linux.command` (Mac ou Linux)

Isso abre uma janela de terminal e já deixa o servidor rodando — sem
precisar digitar nada. Se o Node.js não estiver instalado, o script
avisa e explica onde baixar.

**Opção manual:** abra o terminal (Prompt de Comando / PowerShell no
Windows, Terminal no Mac) dentro da pasta do projeto e rode:

```
node server.js
```

Vai aparecer algo assim:

```
F7 Grifes — servidor rodando
Loja:  http://localhost:3000
Admin: http://localhost:3000/admin
(só acessível neste computador)
```

Deixe essa janela do terminal aberta — é ela que mantém o site no ar.
Fechou o terminal, o site sai do ar. Pra rodar de novo, é só repetir o
`node server.js` (ou dar duplo clique no script de novo).

## 4. Usar

- **Loja:** abra `http://localhost:3000` no navegador.
- **Admin:** abra `http://localhost:3000/admin`, digite a senha que você
  configurou, e pronto — dá pra:
  - Adicionar produto novo (nome, categoria, preço, preço antigo pra
    mostrar desconto, tamanhos, selo "NOVO"/"EDIÇÃO LIMITADA", foto)
  - Editar qualquer produto existente
  - Ocultar um produto sem excluir (ele some da loja mas continua
    salvo, pra reativar depois)
  - Excluir de vez

Tudo que você adicionar aparece automaticamente na seção "Mais
vendidos" da loja, já com filtro por categoria funcionando.

## 4.1. A sacola e o checkout

- O cliente escolhe o tamanho, clica em "Adicionar à sacola" e o
  carrinho fica salvo no navegador dele (localStorage) — sobrevive a
  recarregar a página.
- Na página `/carrinho.html` ele revisa os itens, ajusta quantidade,
  vê o progresso pro frete grátis e preenche nome + telefone pra
  finalizar.
- **Não existe cobrança automática aqui** — não integrei nenhum
  gateway de pagamento (isso exigiria conta própria em um processador
  tipo Mercado Pago/Pagar.me/Stripe, com as credenciais de vocês). O
  que acontece é: o pedido é salvo no servidor (aparece na aba
  "Pedidos" do admin) e o cliente é direcionado pro WhatsApp de vocês
  com a mensagem do pedido já pronta, pra combinarem o pagamento
  (Pix, por exemplo) e a entrega. É o fluxo mais comum pra loja
  pequena que ainda não tem gateway próprio.
- **O número de WhatsApp já está configurado** ((11) 9 7099-9294). Se um
  dia precisar trocar, é só um lugar: abra `public/cart.js`, ache a
  linha `window.F7_WHATSAPP = '...'` perto do topo do arquivo e troque
  pelo número novo, no formato `55` + DDD + número, só dígitos.
- No admin, a aba **Pedidos** mostra tudo que chegou: itens, dados do
  cliente, total, e um seletor de status (Novo / Confirmado / Enviado
  / Cancelado) pra vocês irem controlando o andamento.

## 5. Por que só funciona no seu PC (por padrão)

Por padrão, o servidor escuta apenas em `127.0.0.1` (o endereço interno
do próprio computador), então nenhum outro aparelho — nem na sua rede
Wi-Fi, nem na internet — consegue acessar `localhost:3000`. Só quem está
usando esse computador. Isso é ótimo pra testar e cadastrar produtos com
calma antes de anunciar o site pra qualquer cliente.

**Quer colocar o site no ar de verdade, acessível pra qualquer pessoa?**
Isso já está preparado — veja o guia completo em **`PUBLICAR.md`**. Ele
cobre hospedagem, HTTPS, domínio e um aviso importante sobre onde os
dados (produtos, pedidos, fotos) precisam ficar guardados pra não se
perderem num redeploy.

## 6. Onde ficam seus dados

- `data/products.json` — todos os produtos cadastrados. Esse arquivo é
  a "base de dados" da loja; vale a pena copiar essa pasta de vez em
  quando como backup.
- `data/orders.json` — todos os pedidos recebidos pela sacola.
- `public/uploads/` — as fotos que você envia pelo admin ficam salvas
  aqui.

## 7. Contador do próximo drop

Na primeira vez que o servidor roda, ele grava uma data real (7 dias à
frente) no `config.json`, no campo `"dropDate"` — e essa data fica
fixa dali pra frente (reiniciar o servidor não reseta a contagem).
Pra mudar a data do próximo lançamento, edite esse campo direto no
`config.json`, por exemplo:

```json
"dropDate": "2026-10-01T18:00:00.000Z"
```

Reinicie o servidor depois de editar.

## 8. Arte pra divulgação

Na pasta `marketing/` tem um banner pronto (`banner-instagram-1080.png`,
1080x1080) pra postar ou mostrar como peça de divulgação da marca.

## 9. Problemas comuns

- **"Não foi possível carregar os produtos" na loja:** o servidor não
  está rodando. Abra o terminal na pasta do projeto e rode
  `node server.js`.
- **Porta 3000 ocupada:** troque `"port": 3000` no `config.json` para
  outro número (ex: `3001`) e reinicie o servidor.
- **Esqueci a senha do admin:** abra o `config.json` num editor de
  texto — a senha atual está escrita ali mesmo.

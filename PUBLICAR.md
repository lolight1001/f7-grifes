# Colocando a F7 Grifes no ar

Esse site foi construído pra rodar local primeiro (pra você testar e
cadastrar os produtos com calma). Pra virar um site de verdade, acessível
por qualquer cliente pela internet, faltam três coisas que **só você pode
decidir/pagar**, porque exigem uma conta em seu nome: (1) um lugar pra
hospedar o servidor rodando 24h, (2) HTTPS, e (3) opcionalmente um domínio
(tipo `f7grifes.com.br`). Eu não tenho como criar essa conta ou fazer esse
pagamento por você — mas deixei o código pronto pra isso e vou te guiar
pelo caminho mais simples.

## ⚠️ O aviso mais importante: onde ficam os dados

Esse site guarda os produtos, pedidos e fotos em **arquivos comuns**
(`data/products.json`, `data/orders.json`, `public/uploads/`) — não é um
banco de dados na nuvem. Isso funciona perfeitamente bem, mas significa
que **o servidor onde você hospedar precisa ter um disco permanente**.

Muita hospedagem "fácil" e gratuita (planos free de Render, Railway,
Vercel, etc.) apaga os arquivos toda vez que o servidor reinicia ou você
atualiza o código — nesse caso você perderia produtos, pedidos e fotos
sem aviso. **Antes de escolher onde hospedar, confirme que o plano tem
"disco persistente" ou "volume" incluído**, ou use um VPS normal (opção
abaixo), que já vem com disco permanente por padrão.

## Caminho recomendado: um VPS simples

Um VPS é um computador Linux alugado, só seu. É a opção mais previsível
pra esse tipo de site. Provedores populares no Brasil: **Hetzner Cloud**,
**DigitalOcean**, **Contabo** — todos têm planos básicos entre R$20 e
R$40/mês, mais que suficiente pra começar.

### Passo a passo

1. **Crie a conta e o servidor (VPS)**
   Escolha Ubuntu 22.04 ou mais novo no plano mais barato.

2. **Acesse o servidor por SSH** (o provedor te dá o comando exato, algo
   como `ssh root@SEU_IP`).

3. **Instale o Node.js no servidor:**
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs
   ```

4. **Envie os arquivos do projeto pro servidor.** Do seu computador:
   ```
   scp -r f7-admin root@SEU_IP:/root/
   ```

5. **Troque a senha do admin antes de continuar** — edite
   `f7-admin/config.json` no servidor (`nano config.json`) e mude
   `adminPassword` pra uma senha forte e única.

6. **Instale o PM2** (mantém o site rodando sempre, inclusive depois de
   reiniciar o servidor):
   ```
   npm install -g pm2
   cd /root/f7-admin
   pm2 start server.js --name f7-grifes
   pm2 startup
   pm2 save
   ```

7. **Aponte seu domínio pro IP do servidor** (se tiver domínio): no
   painel onde você registrou o domínio, crie um registro tipo **A**
   apontando para o IP do VPS.

8. **Instale o Caddy** pra ganhar HTTPS automático (ele mesmo busca o
   certificado, sem custo, sem configuração manual de SSL):
   ```
   apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
   apt update && apt install -y caddy
   ```
   Depois edite `/etc/caddy/Caddyfile` com:
   ```
   seudominio.com.br {
       reverse_proxy 127.0.0.1:3000
   }
   ```
   E reinicie: `systemctl restart caddy`. Pronto — HTTPS automático, e o
   `server.js` continua escutando só em `127.0.0.1` internamente (mais
   seguro: quem acessa de fora fala com o Caddy, não direto com o Node).

9. **Teste tudo:** abra `https://seudominio.com.br` e
   `https://seudominio.com.br/admin` no navegador.

Com esse desenho (Caddy na frente, Node escutando só em
`127.0.0.1:3000` por trás), você **não precisa mudar `host` no
config.json** — ele continua `127.0.0.1`, porque quem recebe as conexões
da internet é o Caddy, não o Node diretamente. Isso é mais seguro e é o
jeito recomendado.

## Alternativa mais simples (menos controle): PaaS com disco persistente

Se preferir não mexer com servidor/SSH, serviços como **Railway** ou
**Render** (no plano pago, com "persistent disk"/"volume" ativado)
fazem o deploy a partir do seu código e cuidam de HTTPS e domínio
automaticamente. Nesse caso:

- Configure a variável de ambiente `PORT` — a maioria dessas plataformas
  já define isso sozinha, e o `server.js` já lê `process.env.PORT`
  automaticamente.
- Configure `F7_ADMIN_PASSWORD` como variável de ambiente (mais seguro
  que deixar no `config.json` do repositório).
- **Confirme explicitamente que o volume/disco persistente está
  montado** na pasta do projeto (ou pelo menos nas pastas `data/` e
  `public/uploads/`) antes de cadastrar produtos de verdade — sem isso,
  um redeploy apaga tudo.
- Essas plataformas normalmente cuidam do HTTPS sozinhas — não seria
  necessário mexer no `host` do `config.json` (ele lê a variável de
  ambiente `HOST` só se você precisar forçar `0.0.0.0` manualmente).

## Checklist final antes de anunciar o site pra clientes

- [ ] Senha do admin trocada (não é mais `mudaressasenha123`)
- [ ] Site abre com `https://` (cadeado no navegador), não só `http://`
- [ ] `data/` e `public/uploads/` estão num disco que sobrevive a reinícios
- [ ] Testou cadastrar um produto, fazer um pedido de teste e ver ele
      aparecer na aba Pedidos do admin
- [ ] Trocou o número de WhatsApp em `public/cart.js` (`F7_WHATSAPP`)
      pelo número real, se ainda não fez isso
- [ ] Fez um backup da pasta `data/` (copiar pra outro lugar de vez em
      quando)

# Deploy do AutoStock no Render

Esta configuração publica três recursos:

1. **autostock-db** — PostgreSQL gerenciado.
2. **autostock-api** — Django REST API.
3. **autostock-web** — React/Vite como Static Site.

O arquivo `render.yaml` fica na raiz do repositório e descreve toda a infraestrutura.

## Antes do deploy

A branch `devops/deploy` deve ser mesclada em `develop`.

Depois que o projeto final estiver validado:

1. Abra um Pull Request de `develop` para `main`.
2. Aguarde os checks do GitHub Actions.
3. Faça o merge em `main`.

A `main` será a versão de produção do projeto.

## Criando o Blueprint no Render

1. Crie/acesse uma conta no Render.
2. Conecte sua conta do GitHub.
3. No Dashboard do Render, abra **Blueprints**.
4. Escolha **New Blueprint Instance**.
5. Selecione o repositório do AutoStock.
6. O Render detectará o `render.yaml`.
7. Aplique o Blueprint.

O Render deverá criar:

- banco PostgreSQL;
- backend Django;
- frontend React.

## Como o frontend descobre a API

O `render.yaml` usa a variável automática `RENDER_EXTERNAL_URL` do serviço
`autostock-api`.

Durante o build do frontend, ela é convertida em:

    VITE_API_URL=https://URL-DO-BACKEND.onrender.com/api

Portanto, não é necessário copiar a URL manualmente.

## Banco de dados

`DATABASE_URL` é recebido diretamente do PostgreSQL criado pelo Blueprint.

O Django usa `dj-database-url` para interpretar a URL.

Antes de iniciar cada nova versão do backend, o Render executa:

    python manage.py migrate --noinput

## Arquivos estáticos do Django

O backend usa WhiteNoise.

Durante o build:

    python manage.py collectstatic --noinput

## React Router

O frontend possui uma regra de rewrite:

    /* -> /index.html

Isso permite abrir diretamente URLs como:

    /produtos
    /analises
    /produto/15

sem receber erro 404.

## Criando o administrador em produção

Depois que o backend estiver online:

1. Abra o serviço `autostock-api` no Render.
2. Abra o Shell do serviço.
3. Execute:

    python manage.py createsuperuser

4. Informe usuário, e-mail e senha.

Depois acesse:

    https://URL-DO-BACKEND.onrender.com/admin/

## Testes após o deploy

Backend:

    https://URL-DO-BACKEND.onrender.com/health/

Resposta esperada:

    {"status":"ok","service":"autostock-api"}

Frontend:

    https://URL-DO-FRONTEND.onrender.com

Faça o teste funcional:

1. login;
2. categoria;
3. marca;
4. fornecedor;
5. produto;
6. entrada no estoque;
7. venda;
8. dashboard;
9. curva ABC;
10. previsão de ruptura;
11. sugestão de reposição;
12. QR Code.

## CORS

Para o projeto acadêmico, a configuração de produção permite origens HTTPS
hospedadas no domínio `onrender.com`.

Se no futuro for usado domínio próprio, configure no serviço backend:

    CORS_ALLOWED_ORIGINS=https://seudominio.com
    CSRF_TRUSTED_ORIGINS=https://URL-DO-BACKEND,https://seudominio.com

e remova/restrinja a regex genérica conforme necessário.

## Planos

O Blueprint está configurado com planos gratuitos onde aplicável, adequados para
demonstração acadêmica. Para uso comercial, revise disponibilidade, limites,
backup, desempenho e políticas do provedor antes de colocar clientes reais.

## Atualizações futuras

Depois que os serviços estiverem vinculados ao GitHub, novos commits na branch
de produção podem gerar novos deploys conforme as configurações do Render.

O fluxo recomendado continua:

feature -> develop -> CI -> main -> deploy

# AutoStock

MVP do Projeto Integrador: plataforma web de gestão inteligente de estoque para autopeças.

## Funcionalidades

- Autenticação JWT
- Cadastro de categorias, marcas, fornecedores e produtos
- Registro de vendas pelo front-end com baixa automática de estoque
- Entradas e saídas de estoque
- Registro de vendas com baixa automática
- Histórico de movimentações
- Estoque mínimo e alertas
- Dashboard
- Curva ABC
- Produtos parados
- Cobertura de estoque
- Previsão simples de ruptura
- Sugestão de reposição
- QR Code para acesso rápido ao produto

## Stack

- Front-end: React + TypeScript + Vite
- Back-end: Django + Django REST Framework
- Banco: PostgreSQL
- Gráficos: Recharts
- QR Code: qrcode.react
- Containers: Docker Compose

## Como rodar com Docker

1. Copie `.env.example` para `.env`.
2. Rode:

```bash
docker compose up --build
```

3. Em outro terminal, crie um usuário administrador:

```bash
docker compose exec backend python manage.py createsuperuser
```

4. Acesse:

- Front-end: http://localhost:5173
- API: http://localhost:8000/api
- Admin: http://localhost:8000/admin

## Fluxo Git recomendado

- `main`: versões estáveis
- `develop`: integração
- `feature/...`: funcionalidades
- `chore/...`: configuração
- `docs/...`: documentação
- `test/...`: testes

## Observação acadêmica

A previsão de ruptura e a sugestão de reposição usam heurísticas simples baseadas em consumo médio e prazo de reposição. Isso torna o projeto explicável, testável e adequado ao escopo semestral.

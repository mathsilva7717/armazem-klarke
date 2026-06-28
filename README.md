# Klarke Stock — Sistema Integrado de Armazém

Sistema web interno para gestão de expedição, etiquetas, pedidos de compra e controle de estoque.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Banco | SQLite (better-sqlite3) |
| Auth | JWT (8h de expiração) |
| PDF | jsPDF |
| Etiquetas | ZPL via Impressora Térmica |

---

## Estrutura do Projeto

```
armazem/
├── src/                     # Frontend React
│   ├── pages/
│   │   ├── Login.jsx         # Tela de login
│   │   ├── Dashboard.jsx     # Menu principal
│   │   ├── Deliveries.jsx    # Fila de expedição
│   │   ├── PurchaseOrder.jsx # Gerador de pedidos de compra (PDF)
│   │   ├── Labels.jsx        # Emissor de etiquetas térmicas
│   │   ├── DefectLabels.jsx  # Etiquetas de avaria
│   │   ├── ProductSearch.jsx # Consulta técnica (NCM, CEST, dimensões)
│   │   ├── Users.jsx         # Gestão de operadores
│   │   ├── Logs.jsx          # Logs de auditoria
│   │   └── ResetPassword.jsx # Troca de senha obrigatória
│   ├── api.js                # Axios com baseURL e interceptor de auth
│   └── App.jsx               # Roteamento + proteção de rotas
├── backend/
│   ├── server.js             # API Express + SQLite
│   ├── armazem.sqlite        # Banco de dados (gerado automaticamente)
│   └── uploads/              # Arquivos de NF-e e Romaneio
└── public/
    ├── logok.png             # Logo do sistema
    ├── empresa.png           # Logo da empresa (rodapé/suporte)
    └── loja.png              # Logo para PDF de pedidos
```

---

## Rodar Localmente

### 1. Backend

```bash
cd backend
npm install
node server.js
# Rodando em http://localhost:3005
```

### 2. Frontend

```bash
# na raiz do projeto
npm install
npm run dev
# Rodando em http://localhost:5173
```

---

## Variáveis de Ambiente

Crie um arquivo `backend/.env`:

```env
# OBRIGATÓRIO em produção — chave aleatória e longa
JWT_SECRET=sua-chave-secreta-aqui

# Porta do servidor (padrão: 3005)
PORT=3005

# Origens permitidas para CORS (separadas por vírgula)
# Em produção, coloque apenas o domínio do frontend
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

> **Atenção:** sem `JWT_SECRET` configurado, o sistema usa uma chave padrão insegura e exibe aviso no console.

---

## Usuário Padrão

Criado automaticamente na primeira inicialização:

| Campo   | Valor     |
|---------|-----------|
| Usuário | `admin`   |
| Senha   | `senha123`|

Troque a senha imediatamente após o primeiro acesso.

---

## Níveis de Acesso (Roles)

| Role        | Expedição | Finalizar Pedidos | Criar Pedido de Compra | Gestão de Usuários / Logs |
|-------------|:---------:|:-----------------:|:----------------------:|:-------------------------:|
| `admin`     | ✓         | ✓                 | ✓                      | ✓                         |
| `gerencia`  | ✓         | ✓                 | ✓                      | —                         |
| `expedicao` | ✓         | ✓                 | —                      | —                         |
| `estoque`   | ✓         | ✓                 | —                      | —                         |
| `operator`  | —         | —                 | —                      | —                         |

---

## Fluxo da Fila de Expedição

```
PENDENTE → PREPARANDO → EM_ROTA → FINALIZADO
                                 ↘ ERRO (divergência)
```

Ao finalizar (`FINALIZADO` ou `ERRO`), as saídas de estoque são registradas automaticamente para cada item do pedido.

---

## API — Endpoints Principais

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/login` | Login; retorna JWT |
| POST | `/api/change-password` | Troca senha (autenticado) |

### Pedidos de Expedição
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/orders` | Lista todos os pedidos com itens |
| POST | `/api/orders` | Cria novo pedido |
| PUT | `/api/orders/:id/status` | Atualiza status do pedido |
| DELETE | `/api/orders/:id` | Remove pedido (admin) |
| GET | `/api/orders/:id/history` | Histórico de movimentação |
| PUT | `/api/orders/:id/upload` | Sobe NF-e ou Romaneio |
| DELETE | `/api/orders/:id/upload/:type` | Remove documento |
| PUT | `/api/orders/:id/nfe-key` | Atualiza chave de acesso NF-e |

### Usuários
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/users` | Lista operadores (admin) |
| POST | `/api/users` | Cria operador (admin) |
| PUT | `/api/users/:id` | Edita nome/usuário (admin) |
| PUT | `/api/users/:id/role` | Altera cargo (admin) |
| POST | `/api/users/:id/reset-password` | Reseta senha para `123456` (admin) |
| DELETE | `/api/users/:id` | Remove operador (admin) |

### Estoque e Logs
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/exits` | Saídas de estoque |
| POST | `/api/exits` | Registra saída manual |
| GET | `/api/logs` | Logs de auditoria (admin) |
| POST | `/api/logs/:id/undo` | Desfaz ação de status (admin) |

### Produtos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/products/:query` | Consulta por SKU ou nome |
| POST | `/api/products` | Salva/atualiza produto |

---

## Segurança

- **JWT** com expiração de 8h; token verificado no cliente a cada 5s
- **Rate limiting** em memória: 300 req / 15 min por IP
- **Headers de segurança**: `X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`, `HSTS`, `CSP`
- **Senhas** com bcrypt (salt 10)
- **Upload de arquivos**: somente PDF e imagens (JPG, PNG, WEBP, GIF); extensão validada no servidor
- **CORS** restrito às origens definidas em `ALLOWED_ORIGINS`
- **Queries** parametrizadas (sem concatenação de SQL com input de usuário)
- **Validação de input** nos endpoints de criação de usuário (tamanho, charset)
- **Logs de auditoria** para todas as ações críticas

---

## Build para Produção

```bash
# Gera os arquivos estáticos em /dist
npm run build
```

---

**Desenvolvido por Klarke Solutions — Matheus Silva**

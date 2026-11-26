# RM Control | Frontend

Interface web para acompanhamento de ocorrências logísticas e importação de dados operacionais.

> Versão 0.1.0 — protótipo em desenvolvimento, para execução local.

## Funcionalidades implementadas

- Painel com contagem de chamados, itens e situações.
- Pesquisa por código de ocorrência, carga ou produto.
- Filtros por status e motivo.
- Importação por texto copiado, com prévia e confirmação.
- Exemplo fictício para avaliação.

## Tecnologias

React, TypeScript, Vite e CSS responsivo.

## Executar localmente

Requisitos: Node.js 22+ e npm. Inicie também a [API](https://github.com/pethersonzada/rm-control-backend).

```bash
npm install
npm run dev
```

Acesse http://localhost:5173. Por padrão, a API é consultada em http://127.0.0.1:8000. Para alterar, copie `.env.example` para `.env.local` e ajuste `VITE_API_URL`.

```bash
npm run build
```

## Próximas etapas

Importação detalhada de valores e documentos, histórico de planilhas, indicadores financeiros, conciliação de inventários, autenticação e testes integrados.

## Segurança e licença

Use apenas dados fictícios ou autorizados. Não publique arquivos operacionais, dados pessoais ou credenciais. A versão atual não possui autenticação e não deve ser exposta à internet ou à rede corporativa.

Software proprietário. Consulte [LICENSE](LICENSE).

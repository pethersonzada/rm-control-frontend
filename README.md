# RM Control | Frontend

Interface web para acompanhamento de ocorrências logísticas e importação de dados operacionais.

> Versão 0.2.0 — protótipo em desenvolvimento, para execução local.

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

## Novidades da versão 0.2

- Importação detalhada de produtos, valores, BDV e números de notas fiscais.
- Importação de histórico XLSX com prévia e opção explícita de excluir conflitos.
- Filtros por período e registros de teste, indicadores de valores informados e exportação CSV.
- Conferência de inventário por loja e PLU, sem ajustes automáticos.
- Token de acesso opcional informado na conexão; não é armazenado no navegador.
- Workflow de build no GitHub Actions.

## Próximas etapas

Validar os formatos reais, implementar autenticação individual, regras de prazos e conciliação contábil, paginação no servidor e implantação autorizada.

## Segurança e licença

Use apenas dados fictícios ou autorizados. Não publique arquivos operacionais, dados pessoais ou credenciais. O token opcional não substitui autenticação individual, HTTPS e autorização por perfil. Não exponha esta versão à internet ou à rede corporativa.

Software proprietário. Consulte [LICENSE](LICENSE).

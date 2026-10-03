# IQA-Fácil

Aplicação web educacional e de gestão para cálculo, interpretação, histórico e comparação do Índice de Qualidade das Águas (IQA).

## O que a plataforma faz
- calcula o IQA pelos nove parâmetros clássicos e mostra os subíndices e a classe;
- registra onde a amostra foi coletada: ponto, corpo hídrico, ambiente, município, UF e coordenadas;
- importa planilha (.xlsx ou .csv) no modelo fornecido e calcula todas as linhas de uma vez;
- compara medições entre locais e datas e aceita IQAs antigos já calculados;
- exporta Excel, CSV, imagem e laudo;
- tem perfil do usuário (nome, instituição, função, registro, informações livres), usado no laudo;
- funciona sem login (dados no navegador) e, com login, sincroniza com a nuvem.

## Arquitetura
| Parte | Onde roda | Arquivo |
|---|---|---|
| Interface | GitHub Pages | `index.html` |
| API | Render (Node 18 ou superior) | `server.js`, `package.json` |
| Contas e banco | Supabase | `supabase-schema.sql` |

O endereço da API fica em `window.IQA_API_BASE`, no início do `index.html`.

## Publicar esta versão
1. **Supabase**: abra SQL Editor, cole `supabase-schema.sql` e execute. Ele cria a tabela se não existir e ativa as regras de acesso por usuário (RLS). Confira o resultado das duas consultas finais.
2. **Supabase > Authentication > URL Configuration**: em Redirect URLs deixe só o endereço do app (por exemplo `https://ernandes-sobreira.github.io/IQA-facil/`).
3. **Render**: publique o `server.js` novo. Variáveis: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e, opcionalmente, `ALLOWED_ORIGINS` com a origem do app (por exemplo `https://ernandes-sobreira.github.io`).
4. **GitHub Pages**: substitua o `index.html`.

O `index.html` novo funciona com a API antiga, exceto três recursos que dependem do `server.js` novo: perfil guardado na nuvem, troca ou recuperação de senha e renovação automática da sessão.

## Planilha modelo
Colunas: `local, corpo_hidrico, ambiente, municipio, uf, data, hora, responsavel, latitude, longitude, altitude_m, od_mg_L, coliformes_NMP_100mL, ph, dbo_mg_L, temperatura_C, nitrogenio_total_mg_L, fosforo_total_mg_L, turbidez_UNT, solidos_totais_mg_L, observacoes`.

Obrigatórios: os nove parâmetros e `altitude_m`. A linha EXEMPLO do modelo contém valores fictícios e entra desmarcada na importação.

## Autoria
Ernandes Sobreira Oliveira Junior · Wilkinson Lopes Lazaro · Tadeu Queiroz de Miranda

UNEMAT · PPGCA · PROFÁGUA

# IQA-Fácil

Aplicação web educacional e de gestão para cálculo, interpretação, histórico e comparação do Índice de Qualidade das Águas (IQA).

## O que a plataforma faz
- calcula o IQA pelos nove parâmetros clássicos;
- apresenta os subíndices e a classificação;
- compara medições entre locais e datas;
- aceita o cadastro manual de IQAs antigos;
- exporta CSV, imagem e laudo;
- mantém histórico local no navegador;
- possui camada de autenticação e sincronização com Firebase/Firestore.

## Ativar login e nuvem
1. Crie ou selecione um projeto no Firebase.
2. Adicione um aplicativo Web.
3. Ative **Authentication > Email/Password**.
4. Crie o **Cloud Firestore**.
5. Copie a configuração do SDK Web para `firebase-config.js`.
6. Publique as regras de `firestore.rules`.

Sem Firebase configurado, o IQA-Fácil continua funcionando normalmente e salva os dados localmente.

## Autoria
Ernandes Sobreira Oliveira Junior · Wilkinson Lopes Lazaro · Tadeu Queiroz de Miranda

UNEMAT · PPGCA · PROFÁGUA

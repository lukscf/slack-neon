# Política de privacidade do SL Neon para Slack

**Resumo: a extensão não coleta, não guarda e não envia nenhum dado seu.**

## O que a extensão faz
O SL Neon muda só a aparência do Slack aberto no navegador (`app.slack.com`): cores, fundos animados e efeitos visuais.

## O que ela lê
- A estrutura da página do Slack (nomes de classes e cores dos elementos), para aplicar o tema e corrigir o contraste.
- Ela não lê, copia nem guarda o conteúdo das suas mensagens, canais, arquivos ou contatos.

## O que fica guardado
| O quê | Onde | Por quanto tempo |
|---|---|---|
| Preferências (cor, fundo animado, efeitos ligados) | `chrome.storage.local`, só neste Chrome | até você remover a extensão |

## Para onde vai
Para lugar nenhum. A extensão não tem servidor, conta, login, analytics, anúncios nem telemetria, e não faz nenhuma conexão de rede.

## Permissões
- `storage`: guardar as preferências acima.
- `activeTab`: o popup confere se a extensão está ativa na aba do Slack aberta (diagnóstico).
- `notifications`: mostrar o aviso do Windows das mensagens novas com o ícone do tema e o botão "Abrir no Slack".

## Avisos de mensagens
Quando o Slack avisa de uma mensagem nova, o SL Neon recebe o mesmo título, texto e foto que iriam para o aviso do navegador e monta com eles o aviso neon na página ou o aviso do Windows. Esse conteúdo:
- não é guardado;
- não é registrado;
- não sai do seu computador.

Durante a sessão do navegador fica só um vínculo técnico entre o aviso e a aba do Slack, para o clique abrir a conversa certa. Ele é apagado ao fechar o navegador. A opção "Esconder o texto das mensagens" tira a prévia dos avisos.
- Acesso a `https://app.slack.com/*`: aplicar o tema só nas páginas do Slack. A extensão não acessa nenhum outro site.

## Contato
Dúvidas ou problemas: abra uma issue em https://github.com/lukscf/slack-neon/issues

Projeto independente, sem relação com a Slack Technologies ou a Salesforce. Slack é marca da Slack Technologies, LLC.

export interface ManualItem {
  id: string
  q: string
  /** Parágrafos da resposta; linhas começando com "1." viram passos */
  a: string[]
  /** Palavras extras para a busca (sinônimos) */
  tags?: string
  /** Tela relacionada, para o botão "Abrir" */
  to?: string
}

export interface ManualSection {
  id: string
  title: string
  items: ManualItem[]
}

export const MANUAL: ManualSection[] = [
  {
    id: 'inicio',
    title: 'Primeiros passos',
    items: [
      {
        id: 'por-onde-comecar',
        q: 'Por onde eu começo?',
        a: [
          'Antes de cadastrar os alunos, deixe as configurações prontas:',
          '1. Em Configurações → Geral, confira o nome da arena e preencha a chave Pix e o link do grupo do WhatsApp.',
          '2. Em Configurações → Planos, cadastre os planos mensais (ex.: 2x por semana, R$ 150,00).',
          '3. Em Configurações → Turmas fixas, cadastre as aulas de cada dia da semana.',
          '4. Depois cadastre os alunos em Alunos → Novo aluno e gere as mensalidades em Mensalidades.',
        ],
        tags: 'começar configurar inicio primeiro uso',
        to: '/configuracoes',
      },
      {
        id: 'instalar-celular',
        q: 'Como deixar o sistema como um app no celular?',
        a: [
          'Abra o site no navegador do celular e adicione à tela de início:',
          '1. iPhone (Safari): toque no botão de compartilhar e escolha "Adicionar à Tela de Início".',
          '2. Android (Chrome): toque no menu ⋮ e escolha "Adicionar à tela inicial" ou "Instalar app".',
          'O ícone fica com a logo da Arena e abre direto no sistema.',
        ],
        tags: 'instalar atalho icone tela inicial app',
      },
      {
        id: 'navegar',
        q: 'Onde ficam as telas no celular?',
        a: [
          'A barra de baixo tem os atalhos principais: Início, Alunos, Mensalidades e Quadra.',
          'As outras telas (Aulas avulsas, Eventos, Horários, Configurações, Como usar e Sair) ficam no botão "Mais".',
        ],
        tags: 'menu navegação mais barra',
      },
      {
        id: 'sair',
        q: 'Como sair do sistema?',
        a: ['No celular: botão "Mais" → Sair. No computador: "Sair", no fim da barra lateral.'],
        tags: 'logout deslogar sair',
      },
      {
        id: 'painel',
        q: 'O que mostra a tela Início?',
        a: [
          'É o resumo do dia: alunos ativos, mensalidades em atraso (quantidade e valor), quanto foi recebido no mês (mensalidades, aulas avulsas, quadra e eventos), o próximo evento e as próximas aulas e reservas da quadra.',
          'Toque em qualquer cartão para abrir a tela correspondente.',
        ],
        tags: 'dashboard inicio resumo painel visão geral recebido',
        to: '/',
      },
    ],
  },
  {
    id: 'alunos',
    title: 'Alunos',
    items: [
      {
        id: 'cadastrar-aluno',
        q: 'Como cadastrar um aluno?',
        a: [
          '1. Vá em Alunos e toque em "Novo aluno".',
          '2. Preencha nome, telefone (só DDD + número, o +55 já vem pronto), plano, forma de pagamento e o dia de vencimento.',
          '3. Toque em Salvar.',
        ],
        tags: 'novo aluno adicionar cadastro',
        to: '/alunos',
      },
      {
        id: 'sem-plano',
        q: 'Aluno sem plano recebe mensalidade?',
        a: [
          'Não. Só alunos ativos com plano entram em "Gerar mensalidades do mês". A tela de Mensalidades avisa quantos alunos ativos estão sem plano.',
        ],
        tags: 'plano mensalidade não gerou',
      },
      {
        id: 'status-financeiro',
        q: 'O que significam "Em dia", "Pendente" e "Atrasado"?',
        a: [
          'Em dia: nenhuma mensalidade em aberto.',
          'Pendente: tem mensalidade em aberto, mas ainda dentro do prazo.',
          'Atrasado: tem mensalidade em aberto com vencimento já passado. Isso é calculado sozinho todo dia.',
        ],
        tags: 'situação status atrasado pendente em dia',
      },
      {
        id: 'inativar',
        q: 'Um aluno saiu. Excluo ou inativo?',
        a: [
          'Prefira inativar: abra o aluno → Editar → Status "Inativo". Ele deixa de receber mensalidades, mas o histórico de pagamentos continua guardado.',
          'Excluir apaga o aluno e todo o histórico de mensalidades dele, sem volta.',
        ],
        tags: 'inativo excluir apagar desativar saiu',
      },
      {
        id: 'historico',
        q: 'Onde vejo os pagamentos de um aluno?',
        a: ['Toque no nome do aluno. Na tela dele aparece o histórico de mensalidades, com o total pago e o total em aberto.'],
        tags: 'histórico pagamentos extrato',
        to: '/alunos',
      },
      {
        id: 'whatsapp-aluno',
        q: 'Como falar com o aluno no WhatsApp?',
        a: ['Abra o aluno e toque em "WhatsApp". A conversa abre direto com o número cadastrado.'],
        tags: 'conversa mensagem contato',
      },
    ],
  },
  {
    id: 'mensalidades',
    title: 'Mensalidades',
    items: [
      {
        id: 'gerar',
        q: 'Como gerar as mensalidades do mês?',
        a: [
          '1. Vá em Mensalidades e confira se o mês certo está selecionado.',
          '2. Toque em "Gerar mensalidades do mês".',
          'Todos os alunos ativos com plano recebem a cobrança do mês, com o valor do plano e o vencimento no dia escolhido no cadastro.',
          'Pode tocar de novo sem medo: quem já tem cobrança no mês não é duplicado. Use isso quando entrar um aluno novo no meio do mês.',
        ],
        tags: 'gerar criar cobranças mês duplicar',
        to: '/mensalidades',
      },
      {
        id: 'vencimento-31',
        q: 'E se o vencimento for dia 31 e o mês não tiver 31 dias?',
        a: ['O vencimento vai para o último dia do mês (ex.: 28/02 ou 30/04).'],
        tags: 'dia 31 fevereiro vencimento',
      },
      {
        id: 'marcar-pago',
        q: 'Como registrar que o aluno pagou?',
        a: [
          '1. Na mensalidade, toque em "Marcar como pago".',
          '2. Confira a data do pagamento e a forma (Pix, dinheiro ou cartão).',
          '3. Toque em "Confirmar pagamento".',
        ],
        tags: 'pagar pagamento recebi baixa quitar',
        to: '/mensalidades',
      },
      {
        id: 'desfazer',
        q: 'Marquei como pago por engano. Como desfaço?',
        a: ['Na mensalidade, toque no ⋮ e escolha "Desfazer pagamento". Ela volta para pendente (ou atrasada, se já venceu).'],
        tags: 'erro engano desfazer voltar',
      },
      {
        id: 'cobrar',
        q: 'Como cobrar pelo WhatsApp?',
        a: [
          'Toque em "Cobrar" na mensalidade. O WhatsApp abre na conversa do aluno com a mensagem pronta (nome, valor, vencimento e chave Pix). É só conferir e enviar.',
          'O texto da cobrança pode ser alterado em Configurações → Mensagens.',
        ],
        tags: 'cobrança cobrar lembrete whatsapp pix',
      },
      {
        id: 'editar-valor',
        q: 'Como mudar o valor ou o vencimento de uma mensalidade?',
        a: ['Toque no ⋮ da mensalidade e escolha "Editar valor/vencimento". Isso muda só aquela cobrança, não o plano do aluno.'],
        tags: 'desconto valor diferente vencimento alterar',
      },
      {
        id: 'meses-anteriores',
        q: 'Como ver quem está devendo de meses anteriores?',
        a: ['Em Mensalidades, toque em "Tudo em aberto". Aparecem todas as cobranças não pagas de qualquer mês, com filtro de pendentes e atrasados.'],
        tags: 'devendo devedores inadimplentes atrasados antigos',
        to: '/mensalidades',
      },
      {
        id: 'quando-atrasa',
        q: 'Quando a mensalidade fica "atrasada"?',
        a: ['No dia seguinte ao vencimento, se ainda não foi marcada como paga. O sistema usa o horário de Brasília.'],
        tags: 'atraso atrasado vencida',
      },
    ],
  },
  {
    id: 'aulas',
    title: 'Aulas avulsas (particulares)',
    items: [
      {
        id: 'nova-aula',
        q: 'Como registrar uma aula particular?',
        a: [
          '1. Vá em Mais → Aulas avulsas e toque em "Nova aula".',
          '2. Escolha "Aluno cadastrado" ou "Pessoa avulsa" (para quem não é aluno, informe nome e telefone).',
          '3. Preencha data, horário e valor. Se já pagou, ligue "Pago" e escolha a forma.',
        ],
        tags: 'particular aula avulsa agendar',
        to: '/aulas',
      },
      {
        id: 'confirmar-aula',
        q: 'Como enviar a confirmação da aula?',
        a: ['Toque em "Confirmar" na aula. O WhatsApp abre com a mensagem de confirmação (data, horário e valor) pronta para enviar.'],
        tags: 'confirmação whatsapp lembrete',
      },
      {
        id: 'status-aula',
        q: 'Como marcar a aula como realizada ou cancelada?',
        a: ['Toque no ⋮ da aula e escolha "Marcar como realizada" ou "Cancelar aula". Para registrar o pagamento, use o botão "Pago".'],
        tags: 'realizada cancelada cancelar status',
      },
      {
        id: 'aulas-anteriores',
        q: 'Onde ficam as aulas que já passaram?',
        a: ['Na aba "Anteriores", na tela de Aulas avulsas.'],
        tags: 'passadas antigas histórico',
      },
    ],
  },
  {
    id: 'quadra',
    title: 'Aluguel da quadra',
    items: [
      {
        id: 'nova-reserva',
        q: 'Como reservar a quadra?',
        a: [
          '1. Vá em Quadra e toque em "Nova reserva".',
          '2. Informe o responsável, telefone, data, horário de início e fim e o valor.',
          '3. Toque em Salvar.',
        ],
        tags: 'alugar aluguel reserva agendar quadra',
        to: '/quadra',
      },
      {
        id: 'conflito',
        q: 'Apareceu "Horário ocupado". O que fazer?',
        a: [
          'Já existe outra reserva nesse horário. O aviso mostra quem reservou. Escolha outro horário.',
          'Reservas encostadas são permitidas (ex.: uma das 19h às 20h e outra das 20h às 21h).',
        ],
        tags: 'conflito ocupado choque horário erro',
      },
      {
        id: 'ver-agenda',
        q: 'Como ver a agenda da semana?',
        a: ['Na tela Quadra, toque em "Semana". Use as setas para mudar de semana e toque em um dia para ver só ele.'],
        tags: 'agenda semana calendário dia',
      },
      {
        id: 'reserva-paga',
        q: 'Como marcar a reserva como paga?',
        a: ['Toque em "Pago" na reserva e escolha a forma de pagamento.'],
        tags: 'pagamento pago reserva',
      },
    ],
  },
  {
    id: 'eventos',
    title: 'Eventos',
    items: [
      {
        id: 'criar-evento',
        q: 'Como criar um evento?',
        a: [
          '1. Vá em Mais → Eventos e toque em "Novo evento".',
          '2. Preencha nome, data, horário, local e capacidade (deixe a capacidade em branco se não houver limite).',
          '3. Cadastre os lotes de ingresso com nome e valor (ex.: 1º lote R$ 50,00, 2º lote R$ 70,00).',
        ],
        tags: 'evento torneio festa lote ingresso',
        to: '/eventos',
      },
      {
        id: 'adicionar-pagante',
        q: 'Como adicionar quem pagou o ingresso?',
        a: [
          'Abra o evento e toque em "Adicionar pagante". Ao escolher o lote, o valor é preenchido sozinho.',
          'Para cadastrar várias pessoas seguidas, use "Salvar e próximo": o lote, a forma e a data continuam preenchidos.',
        ],
        tags: 'pagante participante ingresso vender',
      },
      {
        id: 'check-in',
        q: 'Como fazer o check-in na entrada?',
        a: [
          'Abra o evento, busque o nome e toque no quadrado ao lado da pessoa. Ele fica verde.',
          'Use as abas "Não entraram" e "Entraram" para acompanhar a portaria.',
        ],
        tags: 'entrada portaria checkin presença lista',
      },
      {
        id: 'exportar',
        q: 'Como exportar ou imprimir a lista de pagantes?',
        a: [
          'No evento, use os botões (a lista sai sempre em ordem alfabética):',
          '1. "Copiar lista": texto pronto para colar no WhatsApp.',
          '2. "Excel (CSV)": planilha que abre no Excel.',
          '3. "PDF": lista para imprimir, com uma coluna "Entrada" para marcar à mão.',
        ],
        tags: 'exportar imprimir pdf excel planilha copiar lista',
      },
      {
        id: 'lotado',
        q: 'O evento lotou. Ainda dá para adicionar alguém?',
        a: ['Sim. O sistema pede uma confirmação antes de passar da capacidade.'],
        tags: 'lotado capacidade limite',
      },
    ],
  },
  {
    id: 'horarios',
    title: 'Aulas do dia e turmas fixas',
    items: [
      {
        id: 'mensagem-dia',
        q: 'Como mandar a mensagem com as aulas do dia no grupo?',
        a: [
          '1. Vá em Mais → Horários. A mensagem de hoje já aparece pronta ("AULAS DE HOJE !! 🔥🚀" e os horários).',
          '2. Se quiser, edite o texto.',
          '3. Toque em "Abrir grupo" (copia a mensagem e abre o grupo) e cole a mensagem. Ou use "Copiar mensagem" e cole onde quiser.',
          'Para preparar a mensagem de outro dia, use "Amanhã" ou "Outro dia".',
        ],
        tags: 'mensagem grupo horários aulas hoje lista nomes',
        to: '/horarios',
      },
      {
        id: 'cadastrar-turmas',
        q: 'Como cadastrar as aulas que aparecem na mensagem?',
        a: [
          '1. Vá em Configurações → Turmas fixas e toque em "Nova turma".',
          '2. Marque os dias da semana (pode marcar vários), o horário e o nível (ex.: iniciante).',
          'O nível aparece na mensagem exatamente como foi escrito: "17 hrs (iniciante)".',
        ],
        tags: 'turma turmas fixas aula horário nível cadastrar',
        to: '/configuracoes',
      },
      {
        id: 'duplicar-turma',
        q: 'Como duplicar uma turma ou copiar um dia inteiro?',
        a: [
          'Duplicar: toque no ícone de copiar ao lado da aula. O formulário abre preenchido. Mude o que precisar e salve.',
          'Copiar dia: no título do dia, toque em "Copiar dia" e escolha os dias de destino. Aulas iguais que já existirem não são duplicadas.',
        ],
        tags: 'duplicar copiar dia repetir',
      },
      {
        id: 'pausar-turma',
        q: 'Uma turma não vai ter aula por um tempo. Preciso excluir?',
        a: ['Não. Edite a turma e desligue "Turma ativa". Ela some da mensagem até você ligar de novo.'],
        tags: 'pausar desativar férias suspender',
      },
      {
        id: 'mudar-cabecalho',
        q: 'Como mudar o "AULAS DE HOJE !! 🔥🚀"?',
        a: ['Em Configurações → Mensagens, no modelo "Aulas do dia". Mantenha {quando} e {aulas} no texto: eles são trocados pelo dia e pela lista de aulas.'],
        tags: 'cabeçalho título modelo mensagem emoji',
      },
      {
        id: 'abrir-grupo-sem-link',
        q: 'O botão "Abrir grupo" não aparece. Por quê?',
        a: [
          'Falta cadastrar o link do grupo em Configurações → Geral. Para pegar o link no WhatsApp:',
          '1. Abra o grupo e toque no nome dele.',
          '2. Toque em "Convidar via link" (ou "Link do grupo") e copie o link.',
          '3. Cole em Configurações → Geral → Link do grupo e salve.',
        ],
        tags: 'link grupo convite whatsapp',
      },
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações e mensagens',
    items: [
      {
        id: 'modelos',
        q: 'Como alterar os textos das mensagens automáticas?',
        a: [
          'Em Configurações → Mensagens você edita a cobrança, a confirmação de aula avulsa e as aulas do dia. A prévia ao lado mostra como vai ficar no WhatsApp.',
          'Os botões com {chaves} inserem informações automáticas (nome, valor, vencimento...). Use *texto* para negrito e _texto_ para itálico.',
          'Depois de editar, toque em "Salvar mensagens".',
        ],
        tags: 'modelo template texto mensagem cobrança confirmação',
        to: '/configuracoes',
      },
      {
        id: 'planos',
        q: 'Mudei o valor de um plano. As mensalidades mudam?',
        a: ['As próximas mensalidades geradas usam o valor novo. As que já foram geradas continuam com o valor antigo. Para ajustar uma delas, use ⋮ → "Editar valor/vencimento".'],
        tags: 'plano valor reajuste aumento preço',
      },
    ],
  },
  {
    id: 'problemas',
    title: 'Problemas comuns',
    items: [
      {
        id: 'lento',
        q: 'O sistema está demorando para carregar.',
        a: [
          'Confira a internet. O banco de dados fica no plano gratuito do Supabase e pode demorar alguns segundos no primeiro acesso depois de muito tempo parado.',
          'Se uma tela ficar carregando por muito tempo, atualize a página.',
        ],
        tags: 'lento demora carregando travou',
      },
      {
        id: 'copiar-falhou',
        q: 'Apareceu "Não foi possível copiar".',
        a: ['Alguns navegadores bloqueiam a cópia automática. Toque e segure no texto da mensagem, selecione tudo e copie manualmente.'],
        tags: 'copiar erro área de transferência',
      },
      {
        id: 'whatsapp-nao-abre',
        q: 'O botão de WhatsApp diz que não há telefone.',
        a: ['O cadastro está sem telefone. Edite o aluno (ou a reserva/aula) e preencha o telefone com DDD.'],
        tags: 'telefone whatsapp não abre número',
      },
      {
        id: 'senha',
        q: 'Esqueci a senha. E agora?',
        a: ['A senha é gerenciada no painel do Supabase, em Authentication → Users. Quem administra o sistema pode definir uma senha nova ou enviar o e-mail de recuperação por lá.'],
        tags: 'senha esqueci login acesso entrar',
      },
    ],
  },
]

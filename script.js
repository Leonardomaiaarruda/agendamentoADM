// =========================================
// CONFIGURAÇÕES GLOBAIS - SUPABASE
// =========================================
const SUPABASE_URL = "https://ddqqtzwaxsgkbrnfjikv.supabase.co"; 
const SUPABASE_KEY = "sb_publishable__-43znJ2AImyNshY5nsTvA_Q5JUvFUV"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BARBEARIA_ID = "817597d5-9a4b-4c6a-ab3b-9969a2d3999d";
const UUID_DONO = "432083b6-5a4a-4d0a-ae1b-0abec9f8195e";

// Elementos da Interface
const form = document.getElementById('scheduleForm');
const formContainer = document.getElementById('form-container');
const btnAbrirForm = document.getElementById('btnAbrirForm');
const btnSalvar = document.getElementById('btnSalvar');
const statusDiv = document.getElementById('status');
const corpoTabela = document.getElementById('corpoTabela');
const inputDataInicio = document.getElementById('dataInicio');
const inputDataFim = document.getElementById('dataFim');
const selectServico = document.getElementById('servico');

let idSendoEditado = null; 
let listaServicosLocal = []; 

// =========================================
// 1. SISTEMA DE AUTENTICAÇÃO (BLINDAGEM)
// =========================================

/**
 * Verifica se existe uma sessão ativa. Se não houver, mantém a tela de login visível.
 */
let barbeiroLogadoId = null;

// Substitua pelo SEU e-mail de administrador
const EMAIL_DONO = "leonardomaiaarruda@gmail.com"; 

async function verificarAcesso() {
    const { data: { session } } = await _supabase.auth.getSession();
    const loginScreen = document.getElementById('login-screen');
    const btnEquipe = document.getElementById('btn-nav-equipe'); 
    const imgPerfil = document.getElementById('imgPerfil'); 

    if (session) {
        const authUser = session.user;
        const emailUsuario = authUser.email;
        
        // 1. Busca o barbeiro para pegar ID e FOTO_URL
    // Note que agora usamos 'foto_url' (com hífen) para bater com o seu banco
        const { data: barbeiros, error: erroBusca } = await _supabase
            .from('barbeiros')
            .select('id, "foto_url"') 
            .eq('email', emailUsuario);

            if (barbeiros && barbeiros.length > 0) {
                const barbeiro = barbeiros[0];
                
                // 1. VÍNCULO DINÂMICO: Ignora IDs fixos e usa o ID real do banco
                barbeiroLogadoId = barbeiro.id;
                
                // 2. PERSISTÊNCIA: Salva o ID real no navegador para o F5 (essencial para funcionários)
                localStorage.setItem('barbeiro_id', barbeiro.id);

                console.log("Login identificado para o ID:", barbeiroLogadoId);

                const imgPerfil = document.getElementById('imgPerfil');
                if (imgPerfil) {
                    // 3. RECUPERAÇÃO DA FOTO: Usa o nome exato da coluna no Supabase ('foto_url')
                    const urlFoto = barbeiro['foto_url'];

                    if (urlFoto) {
                        // O ?t= força o navegador a ignorar o cache e mostrar a foto nova
                        imgPerfil.src = `${urlFoto}?t=${Date.now()}`;
                    } else {
                        // Fallback: Gera uma inicial colorida se o funcionário não tiver foto
                        const iniciais = emailUsuario.split('@')[0];
                        imgPerfil.src = `https://ui-avatars.com/api/?name=${iniciais}&background=random&color=fff`;
                    }
                }

                // 4. LIMPEZA DE SEGURANÇA (Opcional)
                // Se você tiver uma variável chamada UUID_DONO sendo usada em outros lugares,
                // certifique-se de que as funções de agendamento usem 'barbeiroLogadoId' daqui em diante.
                if (typeof carregarAgenda === "function") {
                    carregarAgenda(); 
                }
            } else {
            // 2. Se não existe na tabela, faz o auto-vínculo usando UPSERT
            console.log("Auto-vinculando novo barbeiro...");
            barbeiroLogadoId = authUser.id;

            const { error: errorAuto } = await _supabase
                .from('barbeiros')
                .upsert([{ 
                    id: barbeiroLogadoId, 
                    email: emailUsuario, 
                    nome: emailUsuario.split('@')[0],
                    barbearia_id: BARBEARIA_ID 
                }], { onConflict: 'id' });
            
            if (errorAuto) console.error("Erro no vínculo:", errorAuto.message);
        }

        // Regra do Botão de Equipe (Apenas para o seu e-mail)
        if (btnEquipe) {
            btnEquipe.style.display = (emailUsuario.toLowerCase() === "leonardomaiaarruda@gmail.com") ? "flex" : "none";
        }

        if (loginScreen) loginScreen.style.display = 'none';
        return true;
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        return false;
    }
}

/** Executa o login com os dados inseridos na interface **/
async function executarLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const btn = document.getElementById('btn-login');
    const erroTxt = document.getElementById('login-erro');

    if (!email || !senha) return alert("Preencha e-mail e senha.");

    btn.innerText = "⌛ Validando...";
    btn.disabled = true;
    if (erroTxt) erroTxt.style.display = 'none';

    // Tentativa de login no Supabase Auth
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
        if (erroTxt) {
            erroTxt.innerText = "Acesso negado: " + error.message;
            erroTxt.style.display = 'block';
        }
        btn.innerText = "Entrar no Painel";
        btn.disabled = false;
    } else {
        // Login sucesso: o Supabase salva o token no localStorage e recarregamos para aplicar o RLS
        location.reload(); 
    }

    // Dentro do sucesso do seu login:
    localStorage.setItem('barbeiro_id', data.id); // Salva o ID do funcionário
    barbeiroLogadoId = data.id;
    carregarFotoPerfil(); // Chama a função para buscar a foto que foi salva anteriormente
}

/**
 * Finaliza a sessão do administrador
 */
async function fazerLogout() {
    try {
        // 1. Desloga da sessão do Supabase (Auth)
        await _supabase.auth.signOut();

        // 2. LIMPA O CACHE LOCAL (Essencial para a foto não "assombrar" o próximo login)
        localStorage.removeItem('barbeiro_id');
        
        // Opcional: Limpar tudo se você não quiser resquícios de outros dados
        // localStorage.clear(); 

        // 3. Recarrega a página para voltar à tela de login
        location.reload();
        
    } catch (error) {
        console.error("Erro ao sair:", error);
        // Mesmo com erro no signOut, forçamos o reload para segurança
        location.reload();
    }
}
// =========================================
// 2. INICIALIZAÇÃO UNIFICADA
// =========================================

window.addEventListener('DOMContentLoaded', async () => {
    const logado = await verificarAcesso();
    
    if (logado) {
        configurarCalendario();
        listarHorarios();     
        carregarServicosBD(); 
    }
});

function configurarCalendario() {
    const inputData = document.getElementById('dataCliente');
    if (!inputData) return;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    
    const dataFormatada = `${ano}-${mes}-${dia}`;
    inputData.setAttribute('min', dataFormatada);
    inputData.value = dataFormatada;
}

// ==========================================
// NAVEGAÇÃO ENTRE TELAS
// ==========================================

function mudarTela(tela) {
    document.querySelectorAll('.tela-content').forEach(t => t.classList.add('hidden'));
    const telaAtiva = document.getElementById(`tela-${tela}`);
    if (telaAtiva) telaAtiva.classList.remove('hidden');

    document.querySelectorAll('.nav-mobile-item, .nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // IDs de navegação desktop e mobile do seu index.html
    const btnMobile = document.getElementById(`btn-nav-${tela}`);
    if (btnMobile) btnMobile.classList.add('active');
    
    const btnDesk = document.getElementById(`btn-nav-${tela}-desk`);
    if (btnDesk) btnDesk.classList.add('active');

    if (tela === 'agenda') listarAgendaClientes();
    if (tela === 'gerar') listarHorarios();
}

// ==========================================
// TELA 1: GESTÃO DE VAGAS (LISTAGEM)
// ==========================================

async function listarHorarios() {
    if (!corpoTabela) return;
    
    // Tenta recuperar o ID da sessão caso a variável global não tenha sido preenchida
    if (!barbeiroLogadoId) {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session) barbeiroLogadoId = session.user.id;
    }

    if (!barbeiroLogadoId) {
        corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center;'>⚠️ Faça login para ver seus horários.</td></tr>";
        return;
    }

    corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center;'>🔄 Buscando seus horários...</td></tr>";

    try {
        const { data: agendamentos, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('barbearia_id', BARBEARIA_ID)
            .or(`barbeiro_id.eq.${barbeiroLogadoId},barbeiro_id.is.null`) // MOSTRA AS DELE E AS QUE ESTÃO SEM DONO
            .order('data', { ascending: true })
            .order('horario', { ascending: true });

        if (error) throw error;

        corpoTabela.innerHTML = ""; 
        const agora = new Date();

        if (agendamentos.length === 0) {
            corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center; padding: 20px;'>Nenhum horário encontrado.</td></tr>";
            return;
        }

        agendamentos.forEach(item => {
            const [ano, mes, dia] = item.data.split('-');
            const [horas, minutos] = item.horario.split(':');
            const dataHoraItem = new Date(ano, mes - 1, dia, horas, minutos);
            const jaPassou = dataHoraItem < agora;

            const row = document.createElement('tr');
            if (jaPassou) row.style.opacity = "0.5";

            // Se for uma vaga antiga (sem dono), adiciona um aviso visual discreto
            const infoVaga = !item.barbeiro_id ? "Disponivel" : (item.servico || (item.status === 'disponivel' ? 'Livre' : 'Ocupado'));

            row.innerHTML = `
                <td data-label="Data/Hora"><strong>${dia}/${mes}</strong><br><span>às ${item.horario.substring(0,5)}</span></td>
                <td data-label="Status/Serviço">
                    <span class="badge-status ${item.status === 'disponivel' ? 'status-verde' : 'status-azul'}">
                        ${infoVaga}
                    </span>
                </td>
                <td data-label="Ação">
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="btn-edit" onclick='prepararEdicao(${JSON.stringify(item)})'>✏️</button>
                        <button class="btn-delete" onclick="deletarVaga('${item.id}')">🗑️</button>
                    </div>
                </td>
            `;
            corpoTabela.appendChild(row);
        });
    } catch (e) {
        console.error("Erro ao listar:", e);
        corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center; color:red;'>Erro ao carregar dados.</td></tr>";
    }
}
async function deletarVaga(id) {
    if (!confirm("Excluir esta vaga permanentemente?")) return;
    exibirStatus("🗑️ Removendo...");
    const { error } = await _supabase.from('agendamentos').delete().eq('id', id);
    if (!error) {
        exibirStatus("✅ Removido!");
        listarHorarios();
    }
}

// ==========================================
// TELA 2: AGENDA DE CLIENTES (HISTÓRICO)
// ==========================================
async function listarAgendaClientes() {
    const corpo = document.getElementById('corpoAgenda');
    if(!corpo) return;

    if (!barbeiroLogadoId) {
        corpo.innerHTML = "<tr><td colspan='7' style='text-align:center; color:orange;'>⚠️ Identificação do profissional não encontrada.</td></tr>";
        return;
    }

    corpo.innerHTML = "<tr><td colspan='7' style='text-align:center;'>⏳ Buscando compromissos...</td></tr>";

    try {
        // 1. Mudança no SELECT: pedimos os dados de agendamentos E o nome da tabela barbeiros
        const { data, error } = await _supabase
            .from('agendamentos')
            .select(`
                *,
                barbeiros ( nome )
            `)
            .eq('barbearia_id', BARBEARIA_ID)
            .eq('barbeiro_id', barbeiroLogadoId) 
            .neq('status', 'disponivel')
            .order('data', { ascending: true })
            .order('horario', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            corpo.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Nenhum agendamento encontrado.</td></tr>";
            return;
        }

        corpo.innerHTML = data.map(h => {
            const [ano, mes, dia] = h.data.split('-');
            const concluido = h.status === 'concluido';
            
            // O nome do barbeiro virá dentro do objeto 'barbeiros'
            const nomeProfissional = h.barbeiros ? h.barbeiros.nome : '---';
            
            return `
                <tr style="${concluido ? 'background: #f4fdf4; opacity: 0.8;' : ''}">
                    <td data-label="Horário">${dia}/${mes} ${h.horario.substring(0,5)}</td>
                    <td data-label="Barbeiro"><strong>${nomeProfissional}</strong></td>
                    <td data-label="Cliente">${h.cliente_nome || '---'}</td>
                    <td data-label="Serviço">${h.servico || '---'}</td>
                    <td data-label="Valor" style="color:green; font-weight:bold;">R$ ${h.preco_final ? h.preco_final.toFixed(2).replace('.',',') : '0,00'}</td>
                    <td data-label="Contato">
                        ${h.cliente_whatsapp ? `<a href="https://wa.me/55${h.cliente_whatsapp}" target="_blank" class="btn-whats">📱 WhatsApp</a>` : '---'}
                    </td>
                    <td data-label="Ação">
                        ${concluido ? '✅' : `<button onclick="concluirAtendimento('${h.id}')" class="btn-check">Concluir</button>`}
                    </td>
                </tr>`;
        }).join('');
    } catch (e) {
        console.error("Erro ao listar agenda:", e);
        corpo.innerHTML = "<tr><td colspan='7' style='text-align:center; color:red;'>Erro ao carregar agenda.</td></tr>";
    }
}

async function concluirAtendimento(id) {
    const { error } = await _supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', id);
    if (!error) {
        exibirStatus("✅ Atendimento concluído!");
        listarAgendaClientes();
    }
}

// ==========================================
// TELA 3: GESTÃO DE SERVIÇOS
// ==========================================

async function carregarServicosBD() {
    try {
        const { data, error } = await _supabase.from('servicos').select('*').eq('barbearia_id', BARBEARIA_ID);
        if (error) throw error;
        listaServicosLocal = data.map(s => `${s.nome} - R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')}`);
        atualizarSelectServicos();
    } catch (e) { console.error("Erro serviços:", e); }
}

function atualizarSelectServicos() {
    if (!selectServico) return;
    let html = `<option value="">-- Deixar em branco (Livre) --</option>`;
    html += listaServicosLocal.map(s => `<option value="${s}">${s}</option>`).join('');
    selectServico.innerHTML = html;
}

async function abrirModalConfig() {
    const modal = document.getElementById('modalConfig');
    if (modal) modal.classList.remove('hidden');
    await carregarServicosBD();
    renderizarListaConfig();
}

function fecharModalConfig() {
    const modal = document.getElementById('modalConfig');
    if (modal) modal.classList.add('hidden');
}

function renderizarListaConfig() {
    const ul = document.getElementById('listaServicosConfig');
    if(!ul) return;
    ul.innerHTML = listaServicosLocal.map((s, index) => `
        <li class="item-servico">
            <span>${s}</span>
            <button onclick="removerServicoLista(${index})" style="background:none; border:none; cursor:pointer;">🗑️</button>
        </li>
    `).join('');
}

function adicionarServicoLista() {
    const nome = document.getElementById('novoServicoNome').value;
    const preco = document.getElementById('novoServicoPreco').value;
    if(nome && preco) {
        listaServicosLocal.push(`${nome} - R$ ${preco.replace('.', ',')}`);
        renderizarListaConfig();
        atualizarSelectServicos();
        document.getElementById('novoServicoNome').value = '';
        document.getElementById('novoServicoPreco').value = '';
    }
}

function removerServicoLista(index) {
    listaServicosLocal.splice(index, 1);
    renderizarListaConfig();
}

async function salvarServicosNoGoogle() { 
    exibirStatus("💾 Salvando serviços...");
    try {
        await _supabase.from('servicos').delete().eq('barbearia_id', BARBEARIA_ID);
        const novos = listaServicosLocal.map(s => {
            const partes = s.split(' - R$ ');
            return { barbearia_id: BARBEARIA_ID, nome: partes[0], preco: partes[1].replace(',', '.') };
        });
        await _supabase.from('servicos').insert(novos);
        exibirStatus("✅ Serviços atualizados!");
        fecharModalConfig();
    } catch (e) { exibirStatus("❌ Erro ao salvar."); }
}

// ==========================================
// LÓGICA DO FORMULÁRIO (GERAR / EDITAR)
// ==========================================

function toggleFormulario() {
    if (formContainer.classList.contains('hidden')) {
        formContainer.classList.remove('hidden');
        btnAbrirForm.textContent = "✖️ Fechar";
    } else {
        fecharELimparFormulario();
    }
}

function fecharELimparFormulario() {
    idSendoEditado = null; 
    form.reset();
    formContainer.classList.add('hidden');
    btnAbrirForm.textContent = "➕ Criar Vagas";
    btnSalvar.textContent = "Gerar Horários";
}

function prepararEdicao(item) {
    idSendoEditado = item.id;
    if (formContainer.classList.contains('hidden')) toggleFormulario();
    document.getElementById('dataInicio').value = item.data;
    document.getElementById('horaInicio').value = item.horario.substring(0,5);
    document.getElementById('servico').value = item.servico || "";
    btnSalvar.textContent = "Atualizar Horário";
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Bloqueio de segurança: se não houver ID de barbeiro, nem tenta enviar
        if (!barbeiroLogadoId) {
            alert("Erro: Seu usuário não está identificado. Vá na aba EQUIPE e cadastre-se primeiro.");
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = "🚀 Processando...";

        try {
            if (!idSendoEditado) {
                // Geração em massa de vagas
                const dataInicioInput = document.getElementById('dataInicio').value;
                const dataFimInput = document.getElementById('dataFim').value;
                const diasSelecionados = Array.from(document.querySelectorAll('input[name="dia_sem"]:checked')).map(el => parseInt(el.value));
                const hInicio = document.getElementById('horaInicio').value;
                const hFim = document.getElementById('horaFim').value;
                const intervalo = parseInt(document.getElementById('intervalo').value);
                const almocoInicio = document.getElementById('almocoInicio').value;
                const almocoFim = document.getElementById('almocoFim').value;
                
                if (diasSelecionados.length === 0) {
                    alert("Selecione pelo menos um dia da semana!");
                    throw new Error("Sem dias selecionados");
                }

                let dataAtual = new Date(dataInicioInput + 'T12:00:00');
                const dataFinal = new Date(dataFimInput + 'T12:00:00');
                let novasVagas = [];

                while (dataAtual <= dataFinal) {
                    if (diasSelecionados.includes(dataAtual.getDay())) {
                        let [h, m] = hInicio.split(':').map(Number);
                        let [hf, mf] = hFim.split(':').map(Number);
                        let tempoMinutos = h * 60 + m;
                        let tempoFimMinutos = hf * 60 + mf;

                        let minAlmocoIni = -1, minAlmocoFim = -1;
                        if (almocoInicio && almocoFim) {
                            let [haI, maI] = almocoInicio.split(':').map(Number);
                            let [haF, maF] = almocoFim.split(':').map(Number);
                            minAlmocoIni = haI * 60 + maI;
                            minAlmocoFim = haF * 60 + maF;
                        }

                        while (tempoMinutos < tempoFimMinutos) {
                           if (!(tempoMinutos >= minAlmocoIni && tempoMinutos < minAlmocoFim)) {
                                let hh = Math.floor(tempoMinutos / 60).toString().padStart(2, '0');
                                let mm = (tempoMinutos % 60).toString().padStart(2, '0');

                                // CADA VAGA PRECISA TER O ID DO BARBEIRO LOGADO
                                novasVagas.push({
                                    barbearia_id: BARBEARIA_ID,
                                    barbeiro_id: barbeiroLogadoId, // <-- Vínculo com o profissional
                                    data: dataAtual.toISOString().split('T')[0],
                                    horario: `${hh}:${mm}:00`,
                                    status: 'disponivel',
                                    servico: document.getElementById('servico').value || null
                                });
                            }
                            tempoMinutos += intervalo;
                        }
                    }
                    dataAtual.setDate(dataAtual.getDate() + 1);
                }

                if (novasVagas.length > 0) {
                    const { error } = await _supabase.from('agendamentos').insert(novasVagas);
                    if (error) {
                        // Trata o erro de Chave Estrangeira (UUID não encontrado na tabela barbeiros)
                        if (error.code === '23503') {
                            throw new Error("Seu usuário precisa ser cadastrado na aba EQUIPE antes de gerar vagas.");
                        }
                        throw error;
                    }
                }

            } else {
                // Edição de vaga única
                const { error } = await _supabase
                    .from('agendamentos')
                    .update({
                        horario: document.getElementById('horaInicio').value + ":00",
                        servico: document.getElementById('servico').value || null
                    })
                    .eq('id', idSendoEditado);
                
                if (error) throw error;
            }

            exibirStatus("✅ Sucesso!");
            fecharELimparFormulario();
            await listarHorarios();

        } catch (error) {
            console.error(error);
            alert(error.message || "Erro ao salvar.");
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = "Gerar Horários";
        }
    });
}

function exibirStatus(msg) {
    if (!statusDiv) return;
    statusDiv.innerText = msg;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
}

// Abrir e Fechar Modal
function abrirModalBarbeiros() {
    document.getElementById('modalBarbeiros').classList.remove('hidden');
    listarBarbeiros();
}

function fecharModalBarbeiros() {
    document.getElementById('modalBarbeiros').classList.add('hidden');
}

// Listar Barbeiros Cadastrados
async function listarBarbeiros() {
    const listaUl = document.getElementById('listaBarbeirosConfig');
    listaUl.innerHTML = "<li>Carregando equipe...</li>";

    const { data, error } = await _supabase
        .from('barbeiros')
        .select('*')
        .eq('barbearia_id', BARBEARIA_ID);

    if (error) return alert("Erro ao carregar equipe");

    listaUl.innerHTML = data.map(b => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #eee;">
            <div>
                <strong>${b.nome}</strong><br>
                <small style="color: #888;">${b.email}</small>
            </div>
            <button onclick="removerBarbeiro('${b.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
        </li>
    `).join('');
}

// Adicionar Novo Barbeiro
async function adicionarBarbeiro() {
    const nome = document.getElementById('novoBarbeiroNome').value;
    const email = document.getElementById('novoBarbeiroEmail').value.toLowerCase().trim();

    if (!nome || !email) return alert("Preencha nome e e-mail.");

    exibirStatus("⌛ Sincronizando...");

    // Se for o dono, usa o UUID fixo. Para outros, deixamos o banco lidar ou o upsert resolver.
    const objeto = { 
        nome: nome, 
        email: email, 
        barbearia_id: BARBEARIA_ID 
    };
    
    if (email === "leonardomaiaarruda@gmail.com") {
        objeto.id = "432083b6-5a4a-4d0a-ae1b-0abec9f8195e";
    }

    const { error } = await _supabase
        .from('barbeiros')
        .upsert([objeto], { onConflict: 'email' });

    if (error) {
        console.error(error);
        alert("Erro ao cadastrar: " + error.message);
    } else {
        exibirStatus("✅ Barbeiro sincronizado!");
        document.getElementById('novoBarbeiroNome').value = "";
        document.getElementById('novoBarbeiroEmail').value = "";
        listarBarbeiros();
    }
}

async function removerBarbeiro(id) {
    if (!confirm("Remover este barbeiro da equipe?")) return;
    await _supabase.from('barbeiros').delete().eq('id', id);
    listarBarbeiros();
}

/**
 * Realiza o upload da foto para o Storage e salva a URL no perfil do barbeiro
 */
async function uploadFotoPerfil(event) {
    const file = event.target.files[0];
    const idUsuario = barbeiroLogadoId || localStorage.getItem('barbeiro_id');

    if (!file || !idUsuario || idUsuario === "undefined") {
        alert("Erro: Usuário não identificado. Tente fazer login novamente.");
        return;
    }

    try {
        const fileName = `avatar_${idUsuario}_${Date.now()}`;
        
        // 1. Upload Storage
        const { data: uploadData, error: uploadError } = await _supabase.storage
            .from('barbearia-files')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. URL Pública
        const { data: { publicUrl } } = _supabase.storage
            .from('barbearia-files')
            .getPublicUrl(fileName);

        // 3. Update no Banco (Onde dava erro 400)
       const { error: updateError } = await _supabase
        .from('barbeiros')
        .update({ foto_url: publicUrl }) 
        .eq('id', barbeiroLogadoId); // <--- Esse ID tem que ser o do funcionário!

        if (updateError) throw updateError;

        // 4. Sucesso Visual
        const imgPreview = document.getElementById('imgPerfil');
        if (imgPreview) imgPreview.src = `${publicUrl}?t=${Date.now()}`;
        
        alert("Foto atualizada!");

    } catch (err) {
        console.error("Erro detalhado no upload:", err);
        alert("Erro ao salvar foto no banco de dados.");
    }
}

/**
 * Carrega a foto atual do barbeiro ao iniciar
 */
// No seu arquivo script.js (Parte do Painel ADM)
async function carregarFotoPerfil() {
    // Tenta pegar o ID da memória ou do localStorage
    const idParaConsulta = barbeiroLogadoId || localStorage.getItem('barbeiro_id');

    // Se continuar undefined, para aqui e evita o erro 400
    if (!idParaConsulta || idParaConsulta === "undefined") {
        console.warn("Cancelando carregarFotoPerfil: ID não encontrado.");
        return;
    }

    try {
        const { data, error } = await _supabase
            .from('barbeiros')
            .select('"foto_url"') // Aspas duplas internas para colunas com hífen
            .eq('id', idParaConsulta)
            .maybeSingle();

        if (error) throw error;

        if (data && data['foto_url']) {
            const imgPreview = document.getElementById('imgPerfil');
            if (imgPreview) {
                imgPreview.src = `${data['foto_url']}?t=${Date.now()}`;
            }
        }
    } catch (err) {
        console.error("Erro ao carregar foto:", err);
    }
}

// IMPORTANTE: Chame esta função logo após o barbeiro logar
window.addEventListener('DOMContentLoaded', async () => {
    const idSalvo = localStorage.getItem('barbeiro_id');
    const telaLogin = document.getElementById('login-screen');

    if (idSalvo) {
        barbeiroLogadoId = idSalvo;
        carregarFotoPerfil();

        // Só tenta carregar a foto se a tela de login estiver escondida
        // ou se o elemento da foto já estiver disponível
        if (!telaLogin || telaLogin.style.display === 'none') {
            setTimeout(() => {
                carregarFotoPerfil();
            }, 300); // Aumentamos um pouco o tempo para segurança
        }
    }

    // Outras inicializações com verificação de segurança
    if (typeof carregarServicos === "function") carregarServicos();
    if (typeof configurarCalendario === "function") configurarCalendario();
});

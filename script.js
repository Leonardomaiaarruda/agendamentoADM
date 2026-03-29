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
        
        // 1. Bloqueio de segurança: verifica se o barbeiro está identificado
        if (!barbeiroLogadoId) {
            alert("Erro: Seu usuário não está identificado. Faça login novamente.");
            return;
        }

        // 2. Captura de Elementos com Verificação (Evita o erro de 'null')
        const elDataInicio = document.getElementById('dataInicio');
        const elDataFim = document.getElementById('dataFim');
        const elHoraInicio = document.getElementById('horaInicio');
        const elHoraFim = document.getElementById('horaFim');
        const elIntervalo = document.getElementById('intervalo');
        const elServico = document.getElementById('servico');
        const elAlmocoInicio = document.getElementById('almocoInicio');
        const elAlmocoFim = document.getElementById('almocoFim');

        // Validação básica: se os campos principais não existem, interrompe para não dar erro
        if (!elDataInicio || !elHoraInicio || !elIntervalo) {
            console.error("Erro: Campos essenciais do formulário não encontrados no HTML.");
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.textContent = "🚀 Processando...";

        try {
            if (!idSendoEditado) {
                // MODO: Geração em massa
                const dataInicioInput = elDataInicio.value;
                const dataFimInput = elDataFim ? elDataFim.value : dataInicioInput;
                const hInicio = elHoraInicio.value;
                const hFim = elHoraFim ? elHoraFim.value : hInicio;
                const intervalo = parseInt(elIntervalo.value) || 30;
                
                const almocoInicio = elAlmocoInicio ? elAlmocoInicio.value : null;
                const almocoFim = elAlmocoFim ? elAlmocoFim.value : null;
                const servicoSelecionado = elServico ? elServico.value : null;

                const diasSelecionados = Array.from(document.querySelectorAll('input[name="dia_sem"]:checked')).map(el => parseInt(el.value));
                
                if (diasSelecionados.length === 0) {
                    alert("Selecione pelo menos um dia da semana!");
                    btnSalvar.disabled = false;
                    btnSalvar.textContent = "Gerar Horários";
                    return;
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
                            // Só adiciona se não estiver no horário de almoço
                            if (!(tempoMinutos >= minAlmocoIni && tempoMinutos < minAlmocoFim)) {
                                let hh = Math.floor(tempoMinutos / 60).toString().padStart(2, '0');
                                let mm = (tempoMinutos % 60).toString().padStart(2, '0');

                                novasVagas.push({
                                    barbearia_id: BARBEARIA_ID,
                                    barbeiro_id: barbeiroLogadoId,
                                    data: dataAtual.toISOString().split('T')[0],
                                    horario: `${hh}:${mm}:00`,
                                    status: 'disponivel',
                                    servico: servicoSelecionado
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
                        if (error.code === '23503') throw new Error("Usuário não vinculado à tabela barbeiros. Verifique a aba Equipe.");
                        throw error;
                    }
                }

            } else {
                // MODO: Edição de vaga única
                const { error } = await _supabase
                    .from('agendamentos')
                    .update({
                        horario: elHoraInicio.value + ":00",
                        servico: elServico ? elServico.value : null
                    })
                    .eq('id', idSendoEditado);
                
                if (error) throw error;
            }

            if (typeof exibirStatus === "function") exibirStatus("✅ Horários Gerados!");
            fecharELimparFormulario();
            await listarHorarios();

        } catch (error) {
            console.error("Erro ao salvar horários:", error);
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
    const modal = document.getElementById('modalBarbeiros');
    if (modal) {
        modal.classList.remove('hidden');
        // USAR SEMPRE A VERSÃO 'Config' que é a mais atualizada que fizemos
        listarBarbeirosConfig(); 
    }
}

function fecharModalBarbeiros() {
    document.getElementById('modalBarbeiros').classList.add('hidden');
}

// Listar Barbeiros Cadastrados


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
        m ,  
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

async function cadastrarBarbeiroCompleto(email, senha, nome) {
    try {
        // PASSO 1: Criar o usuário no Supabase Auth
        // Isso gera o ID oficial na tabela auth.users
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email: email,
            password: senha
        });

        if (authError) throw authError;

        // O ID que o Supabase acabou de criar para esse novo login
        const novoIdAutenticado = authData.user.id;

        // PASSO 2: Agora sim, inserir na sua tabela pública usando o ID gerado
        const { error: dbError } = await _supabase
            .from('barbeiros')
            .insert([{
                id: novoIdAutenticado, // Vínculo perfeito com o Auth
                nome: nome,
                email: email,
                barbearia_id: BARBEARIA_ID,
                "foto-url": null
            }]);

        if (dbError) {
            // Se der erro aqui, o usuário foi criado no Auth mas não na tabela.
            // É raro, mas importante tratar.
            console.error("Erro ao salvar dados extras:", dbError);
            throw dbError;
        }

        alert("Sucesso! Barbeiro autenticado e cadastrado.");

    } catch (err) {
        console.error("Erro no processo:", err.message);
        alert("Falha no cadastro: " + err.message);
    }
}

// =========================================
// GESTÃO DE EQUIPE (CADASTRO ADM)
// =========================================

async function realizarCadastroCompleto() {
    // 1. Referências dos elementos
    const nomeInput = document.getElementById('novoBarbeiroNome');
    const emailInput = document.getElementById('novoBarbeiroEmail');
    const senhaInput = document.getElementById('novoBarbeiroSenha');
    const btn = document.getElementById('btnCadastrarEquipe');
    const status = document.getElementById('statusCadastro');

    // 2. Captura e Limpeza
    const nome = typeof sanitizar === "function" ? sanitizar(nomeInput.value) : nomeInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const senha = senhaInput.value.trim();

    if (!nome || !email || !senha) return alert("⚠️ Preencha todos os campos.");
    if (senha.length < 6) return alert("⚠️ A senha deve ter no mínimo 6 caracteres.");

    // 3. Interface de Carregamento
    btn.disabled = true;
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Processando...";
    status.style.display = 'block';
    status.innerText = "Criando credenciais...";

    try {
        // --- O PULO DO GATO ---
        // Criamos um cliente temporário que NÃO PERSISTE sessão. 
        // Isso impede que o Supabase sobrescreva seu login de ADM.
        const supabaseCadastro = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        // PASSO 1: Criar o usuário usando o cliente ISOLADO
        const { data: authData, error: authError } = await supabaseCadastro.auth.signUp({
            email: email,
            password: senha,
            options: {
                data: { 
                    display_name: nome,
                    role: 'barbeiro' 
                }
            }
        });

        if (authError) throw new Error(`Erro no Auth: ${authError.message}`);
        const novoUsuarioId = authData.user.id;

        // PASSO 2: Inserir na tabela usando o cliente ORIGINAL (_supabase)
        // Usamos o seu login de ADM para ter permissão de escrita no banco
        const { error: dbError } = await _supabase
            .from('barbeiros')
            .insert([{
                id: novoUsuarioId,
                nome: nome,
                email: email,
                barbearia_id: BARBEARIA_ID,
                foto_url: null
            }]);

        if (dbError) throw new Error(`Erro no Banco: ${dbError.message}`);

        // 5. Sucesso
        status.innerText = "🎉 Barbeiro cadastrado com sucesso!";
        status.style.color = "green";
        btn.innerText = "✔️ Cadastrado";
        
        // Limpeza
        nomeInput.value = "";
        emailInput.value = "";
        senhaInput.value = "";

        if (typeof listarBarbeirosConfig === "function") listarBarbeirosConfig();

        setTimeout(() => {
            btn.disabled = false;
            btn.innerText = textoOriginal;
            status.style.display = 'none';
        }, 3000);

    } catch (err) {
        console.error("Falha no cadastro:", err);
        alert(err.message);
        btn.disabled = false;
        btn.innerText = "Tentar Novamente";
        status.innerText = "❌ Erro ao cadastrar.";
        status.style.color = "red";
    }
}

async function listarBarbeirosConfig() {
    const listaUl = document.getElementById('listaBarbeirosConfig');
    if (!listaUl) return;

    // Feedback visual de carregamento
    listaUl.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">⌛ Carregando equipe...</li>';

    try {
        // Busca todos os barbeiros da sua barbearia
        const { data: barbeiros, error } = await _supabase
            .from('barbeiros')
            .select('*')
            .eq('barbearia_id', BARBEARIA_ID)
            .order('nome', { ascending: true });

        if (error) throw error;

        // Se não houver ninguém além de você (ou se a tabela estiver vazia)
        if (!barbeiros || barbeiros.length === 0) {
            listaUl.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">Nenhum barbeiro cadastrado.</li>';
            return;
        }

        // Limpa e preenche a lista
        listaUl.innerHTML = '';
        
        barbeiros.forEach(barbeiro => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.gap = '12px';
            li.style.padding = '12px';
            li.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            li.style.background = 'white';
            li.style.borderRadius = '8px';
            li.style.marginBottom = '8px';

            // Fallback para imagem caso não tenha foto_url
            const fotoUrl = barbeiro.foto_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

            li.innerHTML = `
                <img src="${fotoUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #eee;">
                <div style="flex: 1;">
                    <strong style="display: block; font-size: 0.9rem; color: #333;">${barbeiro.nome}</strong>
                    <span style="font-size: 0.75rem; color: #888;">${barbeiro.email}</span>
                </div>
                <button onclick="removerBarbeiroDaEquipe('${barbeiro.id}', '${barbeiro.nome}')" 
                        style="background: none; border: none; color: #f5365c; cursor: pointer; font-size: 1.1rem; padding: 5px;" title="Remover Barbeiro">
                    🗑️
                </button>
            `;
            listaUl.appendChild(li);
        });

    } catch (err) {
        console.error("Erro ao listar equipe:", err);
        listaUl.innerHTML = '<li style="text-align:center; padding:20px; color:red;">Erro ao carregar lista.</li>';
    }
}

async function removerBarbeiroDaEquipe(id, nome) {
    if (!confirm(`Tem certeza que deseja remover ${nome} da equipe?\nIsso não deletará a conta de login, apenas o vínculo com a barbearia.`)) return;

    try {
        const { error } = await _supabase
            .from('barbeiros')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Barbeiro removido com sucesso!");
        listarBarbeirosConfig(); // Atualiza a lista na tela

    } catch (err) {
        alert("Erro ao remover: " + err.message);
    }
}


// IMPORTANTE: Chame esta função logo após o barbeiro logar
window.addEventListener('DOMContentLoaded', async () => {
    const telaLogin = document.getElementById('login-screen');
    
    // 1. Obtém a sessão atual do Supabase (substitui o idSalvo do localStorage por algo mais seguro)
    const { data: { session }, error } = await _supabase.auth.getSession();

    if (session) {
        // Define o ID global do barbeiro logado
        barbeiroLogadoId = session.user.id;
        
        // Esconde a tela de login se houver sessão ativa
        if (telaLogin) telaLogin.style.display = 'none';

        // 2. Verifica se é Admin para mostrar os botões de Equipe
        await verificarPermissoes();

        // 3. Inicializa os componentes da interface
        if (typeof carregarFotoPerfil === "function") carregarFotoPerfil();
        if (typeof configurarCalendario === "function") configurarCalendario();
        
        // Carrega serviços e horários (IDs conforme seu script.js)
        if (typeof carregarServicosBD === "function") {
            await carregarServicosBD();
        } else if (typeof carregarServicos === "function") {
            carregarServicos();
        }

        if (typeof listarHorarios === "function") listarHorarios();

    } else {
        // Se não houver sessão, garante que a tela de login apareça
        if (telaLogin) telaLogin.style.display = 'flex';
    }
});

// Certifique-se de que sua função de permissões use o email ou metadados
async function verificarPermissoes() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const btnEquipeDesk = document.getElementById('btn-nav-equipe-desk');
    const btnEquipeMobile = document.getElementById('btn-nav-equipe-mobile');

    // Verifica se é você pelo email ou pelo role nos metadados
    const ehAdmin = user.email === "leonardomaiaarruda@gmail.com" || 
                    (user.user_metadata && user.user_metadata.role === 'admin');

    if (ehAdmin) {
        if (btnEquipeDesk) btnEquipeDesk.style.display = 'block';
        if (btnEquipeMobile) btnEquipeMobile.style.display = 'flex';
        console.log("Nível de acesso: Administrador");
    } else {
        if (btnEquipeDesk) btnEquipeDesk.style.display = 'none';
        if (btnEquipeMobile) btnEquipeMobile.style.display = 'none';
        console.log("Nível de acesso: Barbeiro");
    }
}

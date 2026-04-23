
const SUPABASE_URL = "https://ddqqtzwaxsgkbrnfjikv.supabase.co"; 
const SUPABASE_KEY = "sb_publishable__-43znJ2AImyNshY5nsTvA_Q5JUvFUV"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BARBEARIA_ID = "817597d5-9a4b-4c6a-ab3b-9969a2d3999d";
const UUID_DONO = "432083b6-5a4a-4d0a-ae1b-0abec9f8195e";

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

let barbeiroLogadoId = null;

const EMAIL_DONO = "leonardomaiaarruda@gmail.com"; 

async function verificarAcesso() {
    const { data: { session } } = await _supabase.auth.getSession();
    const loginScreen = document.getElementById('login-screen');
    const btnEquipe = document.getElementById('btn-nav-equipe'); 
    const imgPerfil = document.getElementById('imgPerfil'); 

    if (session) {
        const authUser = session.user;
        const emailUsuario = authUser.email;
        
        const { data: barbeiros, error: erroBusca } = await _supabase
            .from('barbeiros')
            .select('id, "foto_url"') 
            .eq('email', emailUsuario);

            if (barbeiros && barbeiros.length > 0) {
                const barbeiro = barbeiros[0];
                
                barbeiroLogadoId = barbeiro.id;
                
                localStorage.setItem('barbeiro_id', barbeiro.id);


                const imgPerfil = document.getElementById('imgPerfil');
                if (imgPerfil) {
                    const urlFoto = barbeiro['foto_url'];

                    if (urlFoto) {
                        imgPerfil.src = `${urlFoto}?t=${Date.now()}`;
                    } else {
                        const iniciais = emailUsuario.split('@')[0];
                        imgPerfil.src = `https://ui-avatars.com/api/?name=${iniciais}&background=random&color=fff`;
                    }
                }

                if (typeof carregarAgenda === "function") {
                    carregarAgenda(); 
                }
            } else {
            barbeiroLogadoId = authUser.id;

            const { error: errorAuto } = await _supabase
                .from('barbeiros')
                .upsert([{ 
                    id: barbeiroLogadoId, 
                    email: emailUsuario, 
                    nome: emailUsuario.split('@')[0],
                    barbearia_id: BARBEARIA_ID 
                }], { onConflict: 'id' });
            
        }

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

async function executarLogin() {
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('login-senha');
    const btnLogin = document.querySelector('#login-screen .btn-primario');

    const email = emailInput.value.trim();
    const senha = senhaInput.value.trim();

    if (!email || !senha) {
        alert("⚠️ Por favor, preencha e-mail e senha.");
        return;
    }

    if (btnLogin) {
        btnLogin.disabled = true;
        btnLogin.innerText = "⏳ Autenticando...";
    }

    try {
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error) throw error;

        const { data: perfil, error: perfilError } = await _supabase
            .from('barbeiros')
            .select('id, ativo')
            .eq('id', data.user.id)
            .single();

        if (perfilError) throw new Error("Erro ao verificar perfil: " + perfilError.message);

        if (perfil && perfil.ativo === false) {
            await _supabase.auth.signOut();
            throw new Error("Sua conta está desativada. Entre em contato com o administrador.");
        }

        if (data.user) {
            localStorage.setItem('barbeiroId', data.user.id);
            localStorage.setItem('barbeiroEmail', data.user.email);
        }

        window.location.reload();

    } catch (err) {        
        const msgErro = err.message.includes("desativada") 
            ? err.message 
            : "❌ Usuário ou senha incorretos.";
            
        alert(msgErro);
        
        if (btnLogin) {
            btnLogin.disabled = false;
            btnLogin.innerText = "Entrar no Painel";
        }
    }
}


async function fazerLogout() {
    try {
        await _supabase.auth.signOut();

        localStorage.removeItem('barbeiro_id');

        location.reload();
        
    } catch (error) {
        location.reload();
    }
}

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


function mudarTela(tela) {
    document.querySelectorAll('.tela-content').forEach(t => t.classList.add('hidden'));
    const telaAtiva = document.getElementById(`tela-${tela}`);
    if (telaAtiva) telaAtiva.classList.remove('hidden');

    document.querySelectorAll('.nav-mobile-item, .nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const btnMobile = document.getElementById(`btn-nav-${tela}`);
    if (btnMobile) btnMobile.classList.add('active');
    
    const btnDesk = document.getElementById(`btn-nav-${tela}-desk`);
    if (btnDesk) btnDesk.classList.add('active');

    if (tela === 'agenda') listarAgendaClientes();
    if (tela === 'gerar') listarHorarios();
}


async function listarHorarios() {
    const corpoTabela = document.getElementById('corpoTabela');
    const filtroData = document.getElementById('filtroDataAdm');
    
    if (!corpoTabela) return;

    let dataParaFiltrar = filtroData ? filtroData.value : "";
    
    if (!dataParaFiltrar) {
        const agora = new Date();
        dataParaFiltrar = agora.toISOString().split('T')[0];
        if (filtroData) filtroData.value = dataParaFiltrar;
    }

    corpoTabela.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">⌛ Carregando grade...</td></tr>';

    try {
        const { data: agendamentos, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('barbeiro_id', barbeiroLogadoId) 
            .eq('data', dataParaFiltrar)
            .order('horario', { ascending: true });

        if (error) throw error;

        if (agendamentos?.length > 0) verificarProximosAtendimentos(agendamentos);

        if (!agendamentos || agendamentos.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:40px; color:#888;">Nenhuma vaga para este dia.</td></tr>';
            return;
        }

        corpoTabela.innerHTML = ''; // Limpa o carregando...

        agendamentos.forEach(vaga => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            
            // Coluna 1: Horário
            const tdHorario = document.createElement('td');
            tdHorario.style.padding = "12px";
            tdHorario.style.fontWeight = "700";
            tdHorario.style.color = "#333";
            tdHorario.textContent = vaga.horario.substring(0, 5);

            // Coluna 2: Status e Informações (Blindada)
            const tdInfo = document.createElement('td');
            tdInfo.style.padding = "12px";
            
            const divInfo = document.createElement('div');
            divInfo.style.display = "flex";
            divInfo.style.flexDirection = "column";

            const spanStatus = document.createElement('span');
            spanStatus.style.fontSize = "11px";
            spanStatus.style.fontWeight = "700";
            spanStatus.style.color = vaga.status === 'disponivel' ? '#2dce89' : '#f5365c';
            spanStatus.textContent = `● ${vaga.status === 'disponivel' ? 'DISPONÍVEL' : 'RESERVADO'}`;

            const spanNome = document.createElement('span');
            spanNome.style.fontSize = "13px";
            spanNome.style.color = "#555";
            spanNome.textContent = vaga.status === 'disponivel' ? 'Vaga aberta' : (vaga.cliente_nome || 'Ocupado');

            divInfo.appendChild(spanStatus);
            divInfo.appendChild(spanNome);
            tdInfo.appendChild(divInfo);

            // Coluna 3: Botões
            const tdAcoes = document.createElement('td');
            tdAcoes.style.padding = "12px";
            tdAcoes.style.textAlign = "right";
            tdAcoes.style.whiteSpace = "nowrap";

            const btnEdit = document.createElement('button');
            btnEdit.textContent = "✏️";
            btnEdit.style.cssText = "background: #5e72e4; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 5px;";
            btnEdit.onclick = () => prepararEdicao(vaga.id);

            const btnDel = document.createElement('button');
            btnDel.textContent = "🗑️";
            btnDel.style.cssText = "background: #fff0f0; border: none; padding: 10px; border-radius: 8px; cursor: pointer;";
            btnDel.onclick = () => deletarVaga(vaga.id);

            tdAcoes.appendChild(btnEdit);
            tdAcoes.appendChild(btnDel);

            tr.appendChild(tdHorario);
            tr.appendChild(tdInfo);
            tr.appendChild(tdAcoes);
            corpoTabela.appendChild(tr);
        });

        const statVagas = document.getElementById('stat-vagas');
        if (statVagas) statVagas.innerText = agendamentos.length;

    } catch (err) {
        corpoTabela.innerHTML = '<tr><td colspan="3" style="color:red; text-align:center;">Erro ao carregar.</td></tr>';
    }
}

async function deletarVaga(id) {
    if (!confirm("Deseja liberar este horário? Ele voltará a ficar disponível na agenda.")) return;
        
    try {
        const { error } = await _supabase
            .from('agendamentos')
            .update({ 
                status: 'disponivel', 
                cliente_nome: null, 
                cliente_whatsapp: null, 
                servico: null,
                preco_final: 0
            })
            .eq('id', id);

        if (error) throw error;

        // Sucesso
        alert("✅ Horário liberado com sucesso!");
        
        await listarHorarios();
        if (typeof listarAgendaClientes === 'function') await listarAgendaClientes();

    } catch (err) {
        alert("Erro ao tentar liberar o horário: " + err.message);
    }
}

async function listarAgendaClientes() {
const idReal = await _supabase.auth.getUser();
if (!idReal.data.user || idReal.data.user.id !== barbeiroLogadoId) {
    window.location.href = 'index.html';
}

    const corpoAgenda = document.getElementById('corpoAgenda');
    if (!corpoAgenda) return;

    corpoAgenda.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 25px; color: #666;">⌛ Carregando agenda...</td></tr>';

    try {
        const idBarbeiro = barbeiroLogadoId || localStorage.getItem('barbeiro_id');
        
        const { data: agendamentos, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('barbeiro_id', idBarbeiro)
            .neq('status', 'disponivel') 
            .order('data', { ascending: true })
            .order('horario', { ascending: true });

        if (error) throw error;

        if (agendamentos && agendamentos.length > 0) {
            if (typeof verificarProximosAtendimentos === 'function') {
                verificarProximosAtendimentos(agendamentos);
            }
        }

        if (!agendamentos || agendamentos.length === 0) {
            corpoAgenda.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:#999;">Nenhum cliente agendado.</td></tr>';
            return;
        }

        corpoAgenda.innerHTML = '';

        agendamentos.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";

            const dataBr = item.data.split('-').reverse().join('/');
            const celularBruto = item.cliente_whatsapp || ""; 
            const numeroLimpo = celularBruto.replace(/\D/g, '');
            let linkChat = numeroLimpo.length >= 10 ? `https://wa.me/55${numeroLimpo.startsWith('55') ? numeroLimpo.substring(2) : numeroLimpo}` : "";

            let htmlFotos = '';
            if (Array.isArray(item.foto_corte) && item.foto_corte.length > 0) {
                const fotosValidas = item.foto_corte.filter(url => url && url !== "null");
                if (fotosValidas.length > 0) {
                    htmlFotos = `<div class="cliente-fotos-bloco" style="display: flex; gap: 4px; margin-top: 5px;">
                        ${fotosValidas.map(url => `
                            <img src="${url}" onclick="window.open('${url}', '_blank')" 
                                 class="foto-corte-agendamento" title="Clique para ampliar"
                                 style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; cursor: pointer;">
                        `).join('')}
                    </div>`;
                }
            }

            tr.innerHTML = `
                <td style="padding: 12px 8px; vertical-align: middle; white-space: nowrap;">
                    <div style="font-weight: 800; color: #1a1c1e; font-size: 14px;">${item.horario.substring(0, 5)}</div>
                    <div style="font-size: 11px; color: #888;">${dataBr}</div>
                </td>

                <td style="padding: 12px 8px; vertical-align: middle;">
                    <div class="celula-cliente-container">
                        <div class="cliente-nome-tabela" style="font-weight: 600; color: #333;">
                            ${item.cliente_nome || 'Não informado'}
                        </div>
                        ${htmlFotos}
                    </div>
                </td>

                <td style="padding: 12px 8px; vertical-align: middle; font-size: 13px; color: #555;">
                    ${item.servico || 'Corte'}
                </td>

                <td style="padding: 12px 8px; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        
                        ${item.status !== 'concluido' ? `
                            <button onclick="concluirAtendimento('${item.id}')" 
                                style="background: #2dce89; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">
                                ✅ CONCLUIR
                            </button>
                        ` : `
                            <span style="color: #2dce89; font-weight: 800; font-size: 10px; background: #eafaf1; padding: 4px 8px; border-radius: 4px;">
                                💰 PAGO
                            </span>
                        `}

                        <button onclick="prepararEdicao('${item.id}')" 
                            style="background: #5e72e4; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 12px;" title="Editar">
                            ✏️
                        </button>

                        <button onclick="deletarAgendamento('${item.id}')" 
                            style="background: #f5365c; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 12px;" title="Excluir">
                            🗑️
                        </button>

                        ${linkChat ? `
                            <button onclick="enviarLembreteDireto('${item.cliente_nome}', '${item.horario}', '${numeroLimpo}')" 
                                style="background: #25D366; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">
                                🔔 AVISAR
                            </button>
                            <a href="${linkChat}" target="_blank" style="text-decoration: none;">
                                <div style="background: #f0f0f0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 14px; border: 1px solid #ddd;">💬</div>
                            </a>
                        ` : ''}
                        
                        <label style="background: #f0f0f0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; cursor: pointer; font-size: 14px; border: 1px solid #ddd;" title="Adicionar Foto">
                            📷
                            <input type="file" accept="image/*" style="display: none;" onchange="uploadFotoCorte(event, '${item.id}')">
                        </label>
                    </div>
                </td>
            `;
            corpoAgenda.appendChild(tr);
        });

    } catch (err) {
        corpoAgenda.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center; padding: 20px;">Erro ao carregar dados.</td></tr>';
    }
}

async function concluirAtendimento(agendamentoId) {
    if (!confirm("Confirmar conclusão e faturamento?")) return;

    try {
        const { data: agendamento, error: fetchError } = await _supabase
            .from('agendamentos')
            .select(`
                *,
                servicos ( nome, preco )
            `)
            .eq('id', agendamentoId)
            .single();

        if (fetchError) throw fetchError;

        let valorFinal = 0;
        let nomeDoServico = "Serviço";

        if (agendamento.servicos) {
            // Caminho A: Pegou da tabela servicos vinculada
            valorFinal = parseFloat(agendamento.servicos.preco) || 0;
            nomeDoServico = agendamento.servicos.nome || agendamento.servico;
        } else {
            // Caminho B: Se a relação falhou, tenta usar o que já estiver no agendamento
            valorFinal = parseFloat(agendamento.valor) || parseFloat(agendamento.preco_final) || 0;
            nomeDoServico = agendamento.servico || "Serviço";
        }

        const { error: updateError } = await _supabase
            .from('agendamentos')
            .update({ 
                status: 'concluido',
                preco_final: valorFinal,
                servico: nomeDoServico 
            })
            .eq('id', agendamentoId);

        if (updateError) throw updateError;      

        alert(`✅ Concluído! R$ ${valorFinal.toFixed(2)} registrado.`);
        
        await listarAgendaClientes();
        if (typeof carregarRelatorioFaturamento === "function") carregarRelatorioFaturamento();

    } catch (err) {
    }
}

async function carregarServicosBD() {
    try {
        const { data, error } = await _supabase
            .from('servicos')
            .select('*')
            .eq('barbearia_id', BARBEARIA_ID)
            .order('nome', { ascending: true });

        if (error) throw error;

        listaServicosLocal = data.map(s => `${s.nome} - R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')}`);
        
        atualizarSelectServicos();
    } catch (e) { 
    }
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

async function adicionarServicoLista() {
    const nomeInput = document.getElementById('novoServicoNome');
    const precoInput = document.getElementById('novoServicoPreco');
    
    const nome = nomeInput.value.trim();
    const preco = precoInput.value.replace('R$', '').replace(',', '.').trim();

    if (!nome || !preco) {
        alert("⚠️ Preencha o nome e o preço do serviço.");
        return;
    }

    try {
        const { error } = await _supabase
            .from('servicos')
            .insert([{ 
                nome: nome, 
                preco: parseFloat(preco), 
                barbearia_id: BARBEARIA_ID 
            }]);

        if (error) throw error;

        nomeInput.value = '';
        precoInput.value = '';
        
        await carregarServicosBD(); 
        renderizarListaConfig();
        
        exibirStatus("✅ Serviço adicionado!");
    } catch (e) {
        alert("Erro ao salvar serviço no banco de dados.");
    }
}

async function removerServicoLista(index) {
    const servicoTexto = listaServicosLocal[index];
    const nomeServico = servicoTexto.split(' - R$ ')[0]; // Pega só o nome antes do preço

    if (!confirm(`Deseja excluir o serviço "${nomeServico}"?`)) return;

    try {
        const { error } = await _supabase
            .from('servicos')
            .delete()
            .eq('nome', nomeServico)
            .eq('barbearia_id', BARBEARIA_ID);

        if (error) throw error;

        await carregarServicosBD();
        renderizarListaConfig();
        exibirStatus("🗑️ Serviço removido!");
    } catch (e) {
    }
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

async function deletarAgendamento(id) {
    if (!confirm("Tem certeza que deseja cancelar este agendamento? Ele voltará a ficar disponível.")) return;

    try {
        const { error } = await _supabase
            .from('agendamentos') 
            .update({ 
                status: 'disponivel', 
                cliente_nome: null, 
                cliente_whatsapp: null, 
                servico: null,
                preco_final: 0
            })
            .eq('id', id);

        if (error) throw error;
        
        if (typeof listarAgendaClientes === 'function') await listarAgendaClientes();
        if (typeof listarHorarios === 'function') await listarHorarios();
        
        exibirStatus("✅ Agendamento liberado!");
    } catch (err) {
        alert("Erro ao tentar liberar o horário.");
    }
}


function toggleFormulario() {
    if (formContainer.classList.contains('hidden')) {
        formContainer.classList.remove('hidden');
        btnAbrirForm.textContent = "✖️ Fechar";
        
        if (!idSendoEditado) {
            document.getElementById('titulo-form').textContent = "Configurar Grade de Horários";
            document.getElementById('btnSalvar').textContent = "Gerar Horários";
            document.getElementById('campos-edicao-cliente').classList.add('hidden');
            
            exibirCamposMassa(true);
        }
    } else {
        fecharELimparFormulario();
    }
}

function fecharELimparFormulario() {
    formContainer.classList.add('hidden');
    btnAbrirForm.textContent = "➕ Gerar Horários";
    
    idSendoEditado = null;
    
    document.getElementById('scheduleForm').reset();
    
    document.getElementById('titulo-form').textContent = "Configurar Grade de Horários";
    document.getElementById('btnSalvar').textContent = "Gerar Horários";
    document.getElementById('btnSalvar').style.background = ""; // Volta cor original do CSS
    
    document.getElementById('campos-edicao-cliente').classList.add('hidden');
    
    exibirCamposMassa(true);
}

function exibirCamposMassa(exibir) {
    const display = exibir ? 'block' : 'none';
    const campos = [
        'container-data-fim',
        'container-dias-semana',
        'container-intervalo',
        'container-hora-fim'
    ];
    
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    });
}


let dataOriginalSendoEditada = null;
let horaOriginalSendoEditada = null;

async function prepararEdicao(id) {
    idSendoEditado = id;

    try {
        const { data: item, error } = await _supabase
            .from('agendamentos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        dataOriginalSendoEditada = item.data;
        horaOriginalSendoEditada = item.horario;

        mudarTela('gerar');
        formContainer.classList.remove('hidden');
        document.getElementById('campos-edicao-cliente').classList.remove('hidden');
        btnAbrirForm.textContent = "✖️ Cancelar Edição";

        const nome = document.getElementById('cliente_nome');
        const whats = document.getElementById('cliente_whatsapp');
        const serv = document.getElementById('servico');
        const data = document.getElementById('dataInicio');
        const hora = document.getElementById('horaInicio');

        if (nome) nome.value = item.cliente_nome || "";
        if (whats) whats.value = item.cliente_whatsapp || "";
        
        if (serv) {
            serv.multiple = true; 

            const servicosSalvos = item.servico ? item.servico.split(',').map(s => s.trim()) : [];

            Array.from(serv.options).forEach(option => {
                option.selected = servicosSalvos.some(s => 
                    option.value.includes(s) || option.text.includes(s)
                );
            });

            serv.onmousedown = function(e) {
                e.preventDefault();
                const option = e.target;
                if (option.tagName === 'OPTION') {
                    option.selected = !option.selected;
                    this.dispatchEvent(new Event('change'));
                }
            };
            
            serv.dispatchEvent(new Event('change'));
            calcularPrecoTotal(); // Adicione isso para calcular ao abrir a edição
        }

        if (data) data.value = item.data || "";
        if (hora) hora.value = item.horario ? item.horario.substring(0, 5) : "";

        exibirCamposMassa(false);
        const btnSalvar = document.getElementById('btnSalvar');
        btnSalvar.innerHTML = "💾 SALVAR ALTERAÇÕES";
        btnSalvar.style.background = "#2dce89";

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        alert("Não foi possível carregar os dados para edição.");
    }

}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idBarbeiro = barbeiroLogadoId || localStorage.getItem('barbeiro_id');
        if (!idBarbeiro) {
            alert("Erro: Sessão expirada. Faça login novamente.");
            return;
        }

        const elDataInicio = document.getElementById('dataInicio');
        const elDataFim = document.getElementById('dataFim');
        const elHoraInicio = document.getElementById('horaInicio');
        const elHoraFim = document.getElementById('horaFim');
        const elIntervalo = document.getElementById('intervalo');
        const elServico = document.getElementById('servico'); // Este é o seu <select multiple>
        const btnSalvar = document.getElementById('btnSalvar');

        btnSalvar.disabled = true;
        btnSalvar.textContent = "🚀 Processando...";

        try {
            if (!idSendoEditado) {
                const dataInicioInput = elDataInicio.value;
                const dataFimInput = elDataFim ? elDataFim.value : dataInicioInput;
                const hInicio = elHoraInicio.value;
                const hFim = elHoraFim ? elHoraFim.value : hInicio;
                const intervalo = elIntervalo ? parseInt(elIntervalo.value) : 30;
                
                const servicosSelecionados = Array.from(elServico.selectedOptions).map(o => o.value).join(', ');

                const diasSelecionados = Array.from(document.querySelectorAll('input[name="dia_sem"]:checked')).map(el => parseInt(el.value));
                if (diasSelecionados.length === 0) throw new Error("Selecione pelo menos um dia da semana!");

                const { data: existentes, error: erroConsulta } = await _supabase
                    .from('agendamentos')
                    .select('data, horario')
                    .eq('barbeiro_id', idBarbeiro)
                    .gte('data', dataInicioInput)
                    .lte('data', dataFimInput);

                if (erroConsulta) throw erroConsulta;

                const mapaExistentes = new Set(existentes.map(h => `${h.data} ${h.horario}`));
                let dataAtual = new Date(dataInicioInput + 'T12:00:00');
                const dataFinal = new Date(dataFimInput + 'T12:00:00');
                let novasVagas = [];

                while (dataAtual <= dataFinal) {
                    if (diasSelecionados.includes(dataAtual.getDay())) {
                        let [h, m] = hInicio.split(':').map(Number);
                        let [hf, mf] = hFim.split(':').map(Number);
                        let tempoMinutos = h * 60 + m;
                        let tempoFimMinutos = hf * 60 + mf;

                        while (tempoMinutos < tempoFimMinutos) {
                            let hh = Math.floor(tempoMinutos / 60).toString().padStart(2, '0');
                            let mm = (tempoMinutos % 60).toString().padStart(2, '0');
                            const dataString = dataAtual.toISOString().split('T')[0];
                            const horaString = `${hh}:${mm}:00`;

                            if (!mapaExistentes.has(`${dataString} ${horaString}`)) {
                                novasVagas.push({
                                    barbearia_id: BARBEARIA_ID,
                                    barbeiro_id: idBarbeiro,
                                    data: dataString,
                                    horario: horaString,
                                    status: 'disponivel',
                                    servico: servicosSelecionados
                                });
                            }
                            tempoMinutos += intervalo;
                        }
                    }
                    dataAtual.setDate(dataAtual.getDate() + 1);
                }

                if (novasVagas.length > 0) {
                    const { error } = await _supabase.from('agendamentos').insert(novasVagas);
                    if (error) throw error;
                    alert(`✅ ${novasVagas.length} horários gerados!`);
                } else {
                    alert("⚠️ Nenhum horário novo foi gerado.");
                }

            } else {
                const nomeCliente = document.getElementById('cliente_nome')?.value.trim();
                const zapCliente = document.getElementById('cliente_whatsapp')?.value.trim();
                
                if (!nomeCliente || nomeCliente.length < 3) throw new Error("Nome do cliente é obrigatório.");

                const novaData = elDataInicio.value;
                const novoHorario = elHoraInicio.value + ":00";
                
                const servicosEscolhidos = Array.from(elServico.selectedOptions).map(o => o.value).join(', ');

                await _supabase
                    .from('agendamentos')
                    .delete()
                    .eq('barbeiro_id', idBarbeiro)
                    .eq('data', novaData)
                    .eq('horario', novoHorario)
                    .eq('status', 'disponivel');

                const precoFinal = calcularPrecoTotal(); 

                const { error: errorUpdate } = await _supabase
                    .from('agendamentos')
                    .update({
                        data: novaData,
                        horario: novoHorario,
                        servico: servicosEscolhidos,
                        cliente_nome: nomeCliente,
                        cliente_whatsapp: zapCliente || '00000000000',
                        preco_final: precoFinal,
                        status: 'ocupado'
                    })
                    .eq('id', idSendoEditado);
                
                if (errorUpdate) throw errorUpdate;

                if (dataOriginalSendoEditada && (dataOriginalSendoEditada !== novaData || horaOriginalSendoEditada !== novoHorario)) {
                    const { data: registroAntigo } = await _supabase
                        .from('agendamentos')
                        .select('id')
                        .eq('barbeiro_id', idBarbeiro)
                        .eq('data', dataOriginalSendoEditada)
                        .eq('horario', horaOriginalSendoEditada)
                        .maybeSingle();

                    if (registroAntigo) {
                        await _supabase
                            .from('agendamentos')
                            .update({ 
                                status: 'disponivel', 
                                cliente_nome: null, 
                                cliente_whatsapp: null, 
                                servico: null 
                            })
                            .eq('id', registroAntigo.id);
                    } else {
                        await _supabase
                            .from('agendamentos')
                            .insert({
                                barbearia_id: BARBEARIA_ID,
                                barbeiro_id: idBarbeiro,
                                data: dataOriginalSendoEditada,
                                horario: horaOriginalSendoEditada,
                                status: 'disponivel'
                            });
                    }
                }
                alert("✅ Agendamento atualizado com sucesso!");
            }

            fecharELimparFormulario();
            await listarHorarios();
            if (typeof listarAgendaClientes === 'function') await listarAgendaClientes();

        } catch (error) {
            alert("Erro: " + (error.message || JSON.stringify(error)));
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = idSendoEditado ? "💾 SALVAR ALTERAÇÕES" : "Gerar Horários";
        }
    });
}
document.getElementById('servico').addEventListener('change', calcularPrecoTotal);

function exibirStatus(msg) {
    if (!statusDiv) return;
    statusDiv.innerText = msg;
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
}

function abrirModalBarbeiros() {
    const modal = document.getElementById('modalBarbeiros');
    if (modal) {
        modal.classList.remove('hidden');
        listarBarbeirosConfig(); 
    }
}

function fecharModalBarbeiros() {
    document.getElementById('modalBarbeiros').classList.add('hidden');
}


async function adicionarBarbeiro() {
    const nome = document.getElementById('novoBarbeiroNome').value;
    const email = document.getElementById('novoBarbeiroEmail').value.toLowerCase().trim();

    if (!nome || !email) return alert("Preencha nome e e-mail.");

    exibirStatus("⌛ Sincronizando...");

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


async function uploadFotoPerfil(event) {
    const file = event.target.files[0];
    const idUsuario = barbeiroLogadoId || localStorage.getItem('barbeiro_id');

    if (!file || !idUsuario || idUsuario === "undefined") {
        alert("Erro: Usuário não identificado. Tente fazer login novamente.");
        return;
    }

    try {
        const fileName = `avatar_${idUsuario}_${Date.now()}`;
        
        const { data: uploadData, error: uploadError } = await _supabase.storage
            .from('barbearia-files')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = _supabase.storage
            .from('barbearia-files')
            .getPublicUrl(fileName);

       const { error: updateError } = await _supabase
        .from('barbeiros')
        .update({ foto_url: publicUrl }) 
        .eq('id', barbeiroLogadoId);

        if (updateError) throw updateError;

        const imgPreview = document.getElementById('imgPerfil');
        if (imgPreview) imgPreview.src = `${publicUrl}?t=${Date.now()}`;
        m ,  
        alert("Foto atualizada!");

    } catch (err) {
       
    }
}


async function carregarFotoPerfil() {
    const idParaConsulta = barbeiroLogadoId || localStorage.getItem('barbeiro_id');

    if (!idParaConsulta || idParaConsulta === "undefined") {
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
    }
}

async function cadastrarBarbeiroCompleto(email, senha, nome) {
    try {
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email: email,
            password: senha
        });

        if (authError) throw authError;

        const novoIdAutenticado = authData.user.id;

        const { error: dbError } = await _supabase
            .from('barbeiros')
            .insert([{
                id: novoIdAutenticado,
                nome: nome,
                email: email,
                barbearia_id: BARBEARIA_ID,
                "foto-url": null
            }]);

        if (dbError) {
            throw dbError;
        }

        alert("Sucesso! Barbeiro autenticado e cadastrado.");

    } catch (err) {
        alert("Falha no cadastro: " + err.message);
    }
}


async function realizarCadastroCompleto() {
    const nomeInput = document.getElementById('novoBarbeiroNome');
    const emailInput = document.getElementById('novoBarbeiroEmail');
    const senhaInput = document.getElementById('novoBarbeiroSenha');
    const btn = document.getElementById('btnCadastrarEquipe');
    const status = document.getElementById('statusCadastro');

    const nome = typeof sanitizar === "function" ? sanitizar(nomeInput.value) : nomeInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const senha = senhaInput.value.trim();

    if (!nome || !email || !senha) return alert("⚠️ Preencha todos os campos.");
    if (senha.length < 6) return alert("⚠️ A senha deve ter no mínimo 6 caracteres.");

    btn.disabled = true;
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Processando...";
    status.style.display = 'block';
    status.innerText = "Criando credenciais...";

    try {
        const supabaseCadastro = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

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

        status.innerText = "🎉 Barbeiro cadastrado com sucesso!";
        status.style.color = "green";
        btn.innerText = "✔️ Cadastrado";
        
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

    listaUl.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">⌛ Carregando equipe...</li>';

    try {
        const { data: barbeiros, error } = await _supabase
            .from('barbeiros')
            .select('*')
            .eq('barbearia_id', BARBEARIA_ID)
            .order('ativo', { ascending: false }) // Mostra os ativos primeiro
            .order('nome', { ascending: true });

        if (error) throw error;

        if (!barbeiros || barbeiros.length === 0) {
            listaUl.innerHTML = '<li style="text-align:center; padding:20px; color:#666;">Nenhum barbeiro cadastrado.</li>';
            return;
        }

        listaUl.innerHTML = '';
        
        barbeiros.forEach(barbeiro => {
            const li = document.createElement('li');
            const estaAtivo = barbeiro.ativo === true;

            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.gap = '12px';
            li.style.padding = '12px';
            li.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            li.style.background = estaAtivo ? 'white' : '#f8f9fa'; // Fundo cinza se inativo
            li.style.borderRadius = '8px';
            li.style.marginBottom = '8px';
            li.style.transition = 'opacity 0.3s ease';
            
            if (!estaAtivo) {
                li.style.opacity = '0.6';
            }

            const fotoUrl = barbeiro.foto_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

            li.innerHTML = `
                <img src="${fotoUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #eee; filter: ${estaAtivo ? 'none' : 'grayscale(100%)'};">
                <div style="flex: 1;">
                    <strong style="display: block; font-size: 0.9rem; color: ${estaAtivo ? '#333' : '#888'};">
                        ${barbeiro.nome} ${estaAtivo ? '' : '<span style="font-size: 0.6rem; background: #ddd; padding: 2px 5px; border-radius: 4px; margin-left: 5px;">DESATIVADO</span>'}
                    </strong>
                    <span style="font-size: 0.75rem; color: #888;">${barbeiro.email}</span>
                </div>
                
                <button onclick="alternarStatusBarbeiro('${barbeiro.id}', ${estaAtivo})" 
                        style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 5px; transition: transform 0.2s;" 
                        title="${estaAtivo ? 'Desativar Acesso' : 'Reativar Acesso'}"
                        onmouseover="this.style.transform='scale(1.2)'" 
                        onmouseout="this.style.transform='scale(1)'">
                    ${estaAtivo ? '🚫' : '✅'}
                </button>
            `;
            listaUl.appendChild(li);
        });

    } catch (err) {
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
        listarBarbeirosConfig();

    } catch (err) {
        alert("Erro ao remover: " + err.message);
    }
}

function abrirModalSenha() {
    document.getElementById('modalSenha').classList.remove('hidden');
    document.getElementById('novaSenhaInput').focus();
}

function fecharModalSenha() {
    document.getElementById('modalSenha').classList.add('hidden');
    document.getElementById('novaSenhaInput').value = "";
    document.getElementById('confirmarSenhaInput').value = "";
}

async function executarTrocaSenha() {
    const novaSenha = document.getElementById('novaSenhaInput').value.trim();
    const confirma = document.getElementById('confirmarSenhaInput').value.trim();
    const btn = document.getElementById('btnConfirmarSenha');
    const status = document.getElementById('statusSenha');

    if (novaSenha.length < 6) return alert("A senha deve ter 6+ caracteres.");
    if (novaSenha !== confirma) return alert("As senhas não coincidem.");

    btn.disabled = true;
    btn.innerText = "⏳ Processando...";

    try {
        const { error } = await _supabase.auth.updateUser({ password: novaSenha });
        if (error) throw error;

        status.style.display = "block";
        status.innerText = "✅ Senha alterada com sucesso!";
        status.style.color = "green";

        setTimeout(() => {
            fecharModalSenha();
            btn.disabled = false;
            btn.innerText = "Atualizar Senha";
            status.style.display = "none";
        }, 1500);

    } catch (err) {
        alert("Erro: " + err.message);
        btn.disabled = false;
        btn.innerText = "Atualizar Senha";
    }
}


async function solicitarRecuperacaoSenha() {
    const emailInput = document.getElementById('email'); 
    
    if (!emailInput) {
        alert("Erro técnico: Campo de e-mail não encontrado.");
        return;
    }

    const email = emailInput.value.trim();

    if (!email) {
        alert("⚠️ Por favor, digite seu e-mail no campo de login para receber o link de recuperação.");
        emailInput.focus();
        return;
    }

    const btnLink = event.target;
    const textoOriginal = btnLink.innerText;
    
    try {
        btnLink.innerText = "⏳ Enviando...";
        btnLink.style.pointerEvents = "none";

        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname,
        });

        if (error) throw error;

        alert("✅ Link enviado! Verifique sua caixa de entrada (e o Spam).");

    } catch (err) {
        alert("❌ Erro: " + err.message);
    } finally {
        btnLink.innerText = textoOriginal;
        btnLink.style.pointerEvents = "auto";
    }
}

async function alternarStatusBarbeiro(id, statusAtual) {
    const novoStatus = !statusAtual; 
    const acao = novoStatus ? "reativar" : "desativar";

    if (!confirm(`Tem certeza que deseja ${acao} este funcionário?`)) return;

    try {
        const { data, error } = await _supabase
            .from('barbeiros')
            .update({ ativo: novoStatus })
            .eq('id', id)
            .select();

        if (error) {
            throw new Error(error.message);
        }

        if (!data || data.length === 0) {
            throw new Error("ID não encontrado ou bloqueado pela RLS.");
        }

        alert(`✅ Sucesso! Funcionário ${novoStatus ? 'Ativo' : 'Desativado'}.`);
        
        if (typeof listarBarbeirosConfig === "function") {
            await listarBarbeirosConfig();
        }

    } catch (err) {
        alert("❌ Falha na operação: " + err.message);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    const telaLogin = document.getElementById('login-screen');
    
    // 1. Obtém a sessão atual
    const { data: { session } } = await _supabase.auth.getSession();

    const urlParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const isRecovery = urlParams.get('type') === 'recovery' || window.location.hash.includes('access_token');

    if (session || isRecovery) {
        if (session) {
            barbeiroLogadoId = session.user.id;
        }
        
        if (telaLogin) telaLogin.style.display = 'none';

        await verificarPermissoes();
        if (typeof carregarFotoPerfil === "function") carregarFotoPerfil();
        if (typeof configurarCalendario === "function") configurarCalendario();
        
        if (typeof carregarServicosBD === "function") {
            await carregarServicosBD();
        } else if (typeof carregarServicos === "function") {
            carregarServicos();
        }

        if (typeof listarHorarios === "function") listarHorarios();

        if (isRecovery) {
            setTimeout(() => {
                if (typeof abrirModalSenha === "function") {
                    abrirModalSenha();
                }
            }, 1200); 
        }

    } else {
        if (telaLogin) telaLogin.style.display = 'flex';
    }

const canalBarbeiros = _supabase
  .channel('mudancas-status')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'barbeiros'
    },
    (payload) => {
      if (payload.new.id === barbeiroLogadoId && payload.new.ativo === false) {
          
          alert("🚨 Sua conta foi desativada pelo administrador. Você será deslogado agora.");
          
          _supabase.auth.signOut().then(() => {
              window.location.reload(); // Recarrega para voltar à tela de login
          });
      }
    }
  )
  .subscribe();
});

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
    } else {
        if (btnEquipeDesk) btnEquipeDesk.style.display = 'none';
        if (btnEquipeMobile) btnEquipeMobile.style.display = 'none';
    }
}


async function uploadFotoCorte(event, agendamentoId) {
    const file = event.target.files[0];
    if (!file) return;

    exibirStatus("⏳ Enviando foto...");

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${agendamentoId}_${Date.now()}.${fileExt}`;
        const filePath = `cortes/${fileName}`;

        const { error: uploadError } = await _supabase.storage
            .from('fotos_cortes')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Pega a URL pública
        const { data: { publicUrl } } = _supabase.storage
            .from('fotos_cortes')
            .getPublicUrl(filePath);

        const { data: agendamento, error: selectError } = await _supabase
            .from('agendamentos')
            .select('foto_corte')
            .eq('id', agendamentoId)
            .single();

        if (selectError) throw selectError;

        let fotosAtuais = agendamento.foto_corte || [];
        
        fotosAtuais.push(publicUrl);

        const { error: updateError } = await _supabase
            .from('agendamentos')
            .update({ foto_corte: fotosAtuais })
            .eq('id', agendamentoId);

        if (updateError) throw updateError;

        exibirStatus("✅ Foto adicionada!");
        listarAgendaClientes();

    } catch (e) {
    }
}


function enviarLembreteManual(nome, horario, telefone) {
    const numLimpo = telefone.replace(/\D/g, '');
    const mensagem = `Olá ${nome}! ✂️ Confirmamos seu horário hoje às ${horario.substring(0,5)}. Te esperamos!`;
    const url = `https://wa.me/55${numLimpo}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
}



function enviarLembreteWhatsapp(nome, horario, whatsapp) {
    const numLimpo = whatsapp.replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${nome}! ✂️ Passando para confirmar seu horário hoje às ${horario.substring(0,5)}. Te esperamos!`);
    
    window.open(`https://wa.me/55${numLimpo}?text=${msg}`, '_blank');
}


function enviarLembreteDireto(nome, horario, telefone) {
    const numLimpo = telefone.replace(/\D/g, '');
    const apenasHora = horario.substring(0, 5);
    
    const saudacao = () => {
        const hora = new Date().getHours();
        if (hora < 12) return "Bom dia";
        if (hora < 18) return "Boa tarde";
        return "Boa noite";
    };

    const mensagem = `${saudacao()}, ${nome}! ✂️\n\nPassando para confirmar seu horário hoje às *${apenasHora}* na barbearia. Tudo certo?\n\nTe esperamos!`;
    
    const url = `https://wa.me/55${numLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

let filaDeAlertas = [];
let ultimoClienteAlertadoId = null;

function verificarProximosAtendimentos(agendamentos) {
    if (!agendamentos) return;

    const agora = new Date();
    filaDeAlertas = [];

    agendamentos.forEach(item => {
        if (!item.cliente_nome || !item.cliente_whatsapp || item.lembrete_enviado === true || item.status === 'disponivel') {
            return;
        }

        const [ano, mes, dia] = item.data.split('-');
        const [hora, min] = item.horario.split(':');
        const dataAgendamento = new Date(ano, mes - 1, dia, hora, min);

        const diferenca = dataAgendamento - agora;
        const minutosRestantes = Math.floor(diferenca / 1000 / 60);

        if (minutosRestantes <= 60 && minutosRestantes >= -15) { 
            filaDeAlertas.push(item);
        }
    });

    if (filaDeAlertas.length > 0 && !document.querySelector('.alerta-proximo-cliente')) {
        exibirProximoDaFila();
    }
}

function exibirProximoDaFila() {
    if (filaDeAlertas.length === 0) return;
    exibirAlertaVisual(filaDeAlertas[0]);
}

function exibirAlertaVisual(item) {
    const alertaAntigo = document.querySelector('.alerta-proximo-cliente');
    if (alertaAntigo) alertaAntigo.remove();

    const container = document.createElement('div');
    container.className = 'alerta-proximo-cliente';
    
    const restantes = filaDeAlertas.length - 1;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <strong style="color: #25D366;">🔔 Lembrete Pendente ${restantes > 0 ? `(+${restantes})` : ''}</strong>
                <div style="margin-top: 5px; font-size: 14px;">
                    <b>${item.cliente_nome}</b> às ${item.horario.substring(0,5)}
                </div>
            </div>
            <button onclick="pularAlerta('${item.id}')" style="background:none; border:none; color:white; cursor:pointer; font-size: 18px;">✕</button>
        </div>
        <button class="btn-alerta-whatsapp" style="width: 100%; margin-top: 10px;" onclick="processarProximoDaFila('${item.id}')">
            ENVIAR MENSAGEM
        </button>
    `;

    document.body.appendChild(container);
    new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
}

async function processarProximoDaFila(id) {
    const item = filaDeAlertas[0];
    const numLimpo = item.cliente_whatsapp.replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá ${item.cliente_nome}! ✂️ Confirmamos seu horário às ${item.horario.substring(0,5)}. Te esperamos!`);
    window.open(`https://wa.me/55${numLimpo}?text=${mensagem}`, '_blank');

    // 2. Remove da fila local
    filaDeAlertas.shift();
    
    try {
        await _supabase
            .from('agendamentos')
            .update({ lembrete_enviado: true })
            .eq('id', id);
    } catch (error) {
    }

    const container = document.querySelector('.alerta-proximo-cliente');
    if (container) container.remove();

    setTimeout(() => {
        if (filaDeAlertas.length > 0) exibirProximoDaFila();
    }, 1000);
}

async function pularAlerta(id) {
    filaDeAlertas.shift();
    
    await _supabase.from('agendamentos').update({ lembrete_enviado: true }).eq('id', id);
    
    const container = document.querySelector('.alerta-proximo-cliente');
    if (container) container.remove();
    exibirProximoDaFila();
}


setInterval(() => {
    if (typeof barbeiroLogadoId !== 'undefined' && barbeiroLogadoId) {
        listarAgendaClientes();
        if (document.getElementById('corpoTabela')) {
            listarHorarios();
        }
    }
}, 120000);


renderizarTabelaFinanceira

async function carregarRelatorioFaturamento() {
    const dataInicio = document.getElementById('fin-data-inicio').value;
    const dataFim = document.getElementById('fin-data-fim').value;

    if (!dataInicio || !dataFim) return;

    try {
        const { data: relatorio, error } = await _supabase
            .from('agendamentos')
            .select('id, servico, preco_final, status, data') 
            .eq('barbeiro_id', barbeiroLogadoId)
            .eq('status', 'concluido')
            .gte('data', dataInicio) 
            .lte('data', dataFim);

        if (error) throw error;
        
        let faturamentoTotal = 0;
        let resumoServicos = {};

        relatorio.forEach(item => {
            const valor = Number(item.preco_final) || 0;
            const nomeServico = item.servico || 'Serviço s/ Nome';

            faturamentoTotal += valor;

            if (!resumoServicos[nomeServico]) {
                resumoServicos[nomeServico] = { qtd: 0, subtotal: 0 };
            }
            resumoServicos[nomeServico].qtd++;
            resumoServicos[nomeServico].subtotal += valor;
        });

        const qtdAtendimentos = relatorio.length;
        const ticketMedio = qtdAtendimentos > 0 ? (faturamentoTotal / qtdAtendimentos) : 0;

        // Atualização Segura usando textContent
        const formatarMoeda = (valor) => valor.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

        const elTotal = document.getElementById('fin-total');
        if (elTotal) {
            elTotal.textContent = formatarMoeda(faturamentoTotal);
        }

        const elQtd = document.getElementById('fin-qtd');
        if (elQtd) {
            elQtd.textContent = qtdAtendimentos;
        }

        const elTicket = document.getElementById('fin-ticket-medio');
        if (elTicket) {
            elTicket.textContent = formatarMoeda(ticketMedio);
        }

        renderizarTabelaFinanceira(resumoServicos);

    } catch (err) {
        console.error("Erro ao carregar financeiro:", err);
    }
}

function renderizarTabelaFinanceira(dadosAgrupados) {
    const container = document.getElementById('containerTabelaServicos');
    if (!container) return;

    // Limpa o conteúdo atual de forma segura
    container.textContent = '';

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Cabeçalho da Tabela
    const thead = document.createElement('thead');
    thead.style.backgroundColor = '#f8f9fa';
    thead.style.textAlign = 'left';

    const headerRow = document.createElement('tr');
    ['SERVIÇO', 'QTD', 'TOTAL'].forEach(texto => {
        const th = document.createElement('th');
        th.style.padding = '12px';
        th.style.fontSize = '12px';
        th.style.color = '#666';
        th.textContent = texto;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Corpo da Tabela
    const tbody = document.createElement('tbody');
    const itens = Object.entries(dadosAgrupados);

    if (itens.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        td.textContent = 'Nenhum serviço concluído.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        itens.forEach(([nome, info]) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            // Nome do Serviço
            const tdNome = document.createElement('td');
            tdNome.style.padding = '12px';
            tdNome.style.fontWeight = 'bold';
            tdNome.textContent = nome; // AQUI ESTÁ A BLINDAGEM: qualquer tag no nome será exibida como texto, não executada.
            
            // Quantidade
            const tdQtd = document.createElement('td');
            tdQtd.style.padding = '12px';
            tdQtd.textContent = info.qtd;

            // Subtotal
            const tdTotal = document.createElement('td');
            tdTotal.style.padding = '12px';
            tdTotal.style.color = '#2dce89';
            tdTotal.style.fontWeight = 'bold';
            tdTotal.textContent = info.subtotal.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

            tr.appendChild(tdNome);
            tr.appendChild(tdQtd);
            tr.appendChild(tdTotal);
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function mostrarTelaFinanceiro() {
    const telaFin = document.getElementById('tela-financeiro');

    if (!telaFin) {
        alert("Erro técnico: O sistema não encontrou a tela de faturamento no HTML.");
        return;
    }

    const esconder = ['secao-agenda', 'form-container', 'btnAbrirForm', 'container-filtros-adm'];
    esconder.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    setTimeout(() => {
        telaFin.style.display = 'block';
        window.scrollTo(0, 0);
        
        const campoInicio = document.getElementById('fin-data-inicio');
        if (campoInicio && !campoInicio.value) {
            const hoje = new Date();
            document.getElementById('fin-data-inicio').value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
            document.getElementById('fin-data-fim').value = hoje.toISOString().split('T')[0];
        }
        
        gerarRelatorioFinanceiro();
    }, 10);
}

function voltarParaAgenda() {
    const telaFin = document.getElementById('tela-financeiro');
    if (telaFin) telaFin.style.display = 'none';

    if (document.getElementById('secao-agenda')) document.getElementById('secao-agenda').style.display = 'block';
    if (document.getElementById('btnAbrirForm')) document.getElementById('btnAbrirForm').style.display = 'block';
    if (document.getElementById('container-filtros-adm')) document.getElementById('container-filtros-adm').style.display = 'flex';
}

async function gerarRelatorioFinanceiro() {
    let barbeiroId = localStorage.getItem('barbeiroId');

    if (!barbeiroId || barbeiroId === "null" || barbeiroId === "undefined") {
        const { data: sessionData } = await _supabase.auth.getSession();
        if (sessionData?.session?.user) {
            barbeiroId = sessionData.session.user.id;
            localStorage.setItem('barbeiroId', barbeiroId);
        }
    }

    if (!barbeiroId) {
        document.getElementById('container-tabela-fin').innerHTML = 
            '<div style="text-align:center; padding:20px;">' +
            '<p style="color:#e74c3c; font-weight:bold;">⚠️ Sessão não identificada.</p>' +
            '<p style="font-size:13px; color:#666;">Por favor, faça login novamente na agenda.</p>' +
            '</div>';
        return;
    }

    const dataInicio = document.getElementById('fin-data-inicio').value;
    const dataFim = document.getElementById('fin-data-fim').value;

    if (!dataInicio || !dataFim) return;

    document.getElementById('container-tabela-fin').innerHTML = '<p style="text-align:center; padding:20px;">⏳ Processando dados...</p>';

    try {
        const { data: resultados, error } = await _supabase
            .from('agendamentos')
            .select(`
                *,
                servicos:servico_id ( nome, preco )
            `)
            .eq('barbeiro_id', barbeiroId)
            .eq('status', 'concluido')
            .gte('data', dataInicio)
            .lte('data', dataFim);

        if (error) throw error;

        let faturamentoTotal = 0;
        let totalAtendimentos = resultados ? resultados.length : 0;
        let resumoServicos = {}; 

        resultados.forEach(item => {
            const valorSrv = item.servicos?.preco || item.valor || 0;
            faturamentoTotal += parseFloat(valorSrv);

            const nomeSrv = item.servicos?.nome || "Serviço s/ Nome";
            if (!resumoServicos[nomeSrv]) {
                resumoServicos[nomeSrv] = { qtd: 0, total: 0 };
            }
            resumoServicos[nomeSrv].qtd++;
            resumoServicos[nomeSrv].total += parseFloat(valorSrv);
        });

        const ticketMedio = totalAtendimentos > 0 ? (faturamentoTotal / totalAtendimentos) : 0;

        document.getElementById('fin-total-valor').innerText = faturamentoTotal.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });
        document.getElementById('fin-total-qtd').innerText = totalAtendimentos;
        document.getElementById('fin-ticket-medio').innerText = ticketMedio.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

        if (totalAtendimentos === 0) {
            document.getElementById('container-tabela-fin').innerHTML = '<p style="text-align:center; color:#888; padding:20px;">Nenhum faturamento registrado neste período.</p>';
        } else {
            let htmlTabela = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 2px solid #eee; color: #888; font-size: 11px;">
                            <th style="padding: 12px;">SERVIÇO</th>
                            <th style="padding: 12px;">QTD</th>
                            <th style="padding: 12px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const srv in resumoServicos) {
                htmlTabela += `
                    <tr style="border-bottom: 1px solid #f2f2f2; font-size: 14px; color: #2c3e50;">
                        <td style="padding: 12px; font-weight: 600;">${srv}</td>
                        <td style="padding: 12px;">${resumoServicos[srv].qtd}x</td>
                        <td style="padding: 12px; font-weight: 600;">${resumoServicos[srv].total.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                `;
            }

            htmlTabela += `</tbody></table>`;
            document.getElementById('container-tabela-fin').innerHTML = htmlTabela;
        }

    } catch (err) {
        document.getElementById('container-tabela-fin').innerHTML = '<p style="color:red; text-align:center; padding:20px;">Falha ao conectar com o banco de dados.</p>';
    }
}

function renderizarTabelaDetalhada(dados) {
    const container = document.getElementById('container-tabela-fin');
    
    if (Object.keys(dados).length === 0) {
        container.innerHTML = '<p style="padding:30px; text-align:center; color:#888;">Nenhum faturamento encontrado neste período.</p>';
        return;
    }

    let html = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #fcfcfd; text-align: left; font-size: 12px; color: #888;">
                <tr>
                    <th style="padding: 15px;">SERVIÇO</th>
                    <th style="padding: 15px;">QTD</th>
                    <th style="padding: 15px;">TOTAL BRUTO</th>
                </tr>
            </thead>
            <tbody>
    `;

    Object.entries(dados).forEach(([nome, info]) => {
        html += `
            <tr style="border-bottom: 1px solid #f8f9fe;">
                <td style="padding: 15px; font-weight: 600; color:#333;">${nome}</td>
                <td style="padding: 15px;">${info.qtd}</td>
                <td style="padding: 15px; font-weight: bold; color: #2dce89;">${info.subtotal.toLocaleString('pt-br', {style: 'currency', currency: 'BRL'})}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

function configurarDatasPadrao() {
    const agora = new Date();
    const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0];
    
    if(document.getElementById('fin-data-inicio')) document.getElementById('fin-data-inicio').value = primeiroDia;
    if(document.getElementById('fin-data-fim')) document.getElementById('fin-data-fim').value = ultimoDia;
}


function inicializarFinanceiro() {
    barbeiroLogadoId = localStorage.getItem('barbeiro_id') || localStorage.getItem('barbeiroId');
    
    if (!barbeiroLogadoId) {
        alert("Sessão expirada. Por favor, faça login novamente.");
        window.location.href = 'index.html';
        return;
    }

    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const dataHoje = hoje.toISOString().split('T')[0];

    const inputInicio = document.getElementById('fin-data-inicio');
    const inputFim = document.getElementById('fin-data-fim');

    if (inputInicio) inputInicio.value = primeiroDia;
    if (inputFim) inputFim.value = dataHoje;

    carregarRelatorioFaturamento();
}

function calcularPrecoTotal() {
    const elServico = document.getElementById('servico');
    const valorTotal = Array.from(elServico.selectedOptions).reduce((total, option) => {
        const texto = option.text;
        const match = texto.match(/R\$\s?([\d.,]+)/);
        if (match) {
            const preco = parseFloat(match[1].replace(',', '.'));
            return total + preco;
        }
        return total;
    }, 0);

    const elPrecoExibicao = document.getElementById('preco_exibicao');
    if (elPrecoExibicao) {
        elPrecoExibicao.textContent = `Total: R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
    }
    
    return valorTotal; 
}

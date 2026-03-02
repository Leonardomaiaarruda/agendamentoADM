// ==========================================
// CONFIGURAÇÕES INICIAIS
// ==========================================
const URL_WEB_APP = 'https://script.google.com/macros/s/AKfycbyWCgK2M0giR42Wr_4oNsCvBmw_r4iLFTyT6bb9ZOGxJ12rQ1pQCCHaB9Qo-QK41-v0ww/exec';

const form = document.getElementById('scheduleForm');
const formContainer = document.getElementById('form-container');
const btnAbrirForm = document.getElementById('btnAbrirForm');
const btnSalvar = document.getElementById('btnSalvar');
const statusDiv = document.getElementById('status');
const corpoTabela = document.getElementById('corpoTabela');
const inputDataInicio = document.getElementById('dataInicio');
const inputDataFim = document.getElementById('dataFim');
const selectServico = document.getElementById('servico');

let linhaSendoEditada = null; 
let listaServicosLocal = []; 

// Trava o calendário para não aceitar datas passadas
const hojeISO = new Date().toISOString().split('T')[0];
if (inputDataInicio) {
    inputDataInicio.setAttribute('min', hojeISO);
    inputDataInicio.value = hojeISO;
}
if (inputDataFim) {
    inputDataFim.setAttribute('min', hojeISO);
    inputDataFim.value = hojeISO;
}

// ==========================================
// NAVEGAÇÃO E VISIBILIDADE
// ==========================================

function mudarTela(tela) {
    document.querySelectorAll('.tela-content').forEach(t => t.classList.add('hidden'));
    const telaAtiva = document.getElementById(`tela-${tela}`);
    if (telaAtiva) telaAtiva.classList.remove('hidden');

    document.querySelectorAll('.nav-mobile-item').forEach(btn => btn.classList.remove('active'));
    const btnMobile = document.getElementById(`btn-nav-${tela}`);
    if (btnMobile) btnMobile.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const btnDesk = document.getElementById(`btn-nav-${tela}-desk`);
    if (btnDesk) btnDesk.classList.add('active');

    window.scrollTo(0, 0);

    if (tela === 'agenda') {
        listarAgendaClientes();
    }
}

function toggleFormulario() {
    if (formContainer.classList.contains('hidden')) {
        formContainer.classList.remove('hidden');
        btnAbrirForm.textContent = "✖️ Fechar Formulário";
        btnAbrirForm.style.backgroundColor = "#6c757d";
    } else {
        fecharELimparFormulario();
    }
}

function fecharELimparFormulario() {
    // 1. Reseta o controle de edição
    linhaSendoEditada = null; 

    // 2. Limpa todos os campos de texto e seleções
    if(form) form.reset();

    // 3. Define as datas padrão (Hoje)
    const hoje = new Date().toISOString().split('T')[0];
    if (inputDataInicio) inputDataInicio.value = hoje;
    if (inputDataFim) inputDataFim.value = hoje;

    // 4. Restaura o botão de Salvar/Gerar para o estado original
    if(btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Gerar Horários"; // Nome padrão para criação
        btnSalvar.style.backgroundColor = "";     // Remove cores de edição (verde/azul)
    }

    // 5. Esconde o container do formulário
    if(formContainer) formContainer.classList.add('hidden');

    // 6. Restaura o botão principal de abertura
    if(btnAbrirForm) {
        btnAbrirForm.textContent = "➕ Criar Vagas";
        btnAbrirForm.style.backgroundColor = "";
    }

    // 7. Limpa mensagens de erro ou status
    if(statusDiv) statusDiv.textContent = "";
    
    // Rola para o topo da tabela para melhor visualização
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// GESTÃO DE SERVIÇOS (MODAL)
// ==========================================

function abrirModalConfig() {
    listarHorarios().then(() => {
        document.getElementById('modalConfig').classList.remove('hidden');
        renderizarListaConfig();
    });
}

function fecharModalConfig() {
    document.getElementById('modalConfig').classList.add('hidden');
    const inputNome = document.getElementById('novoServicoNome');
    if(inputNome) inputNome.value = "";
}

function atualizarSelectServicos() {
    if (!selectServico) return;
    let html = `<option value="">-- Deixar em branco (Cliente seleciona) --</option>`;
    if (listaServicosLocal.length > 0) {
        html += listaServicosLocal.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    selectServico.innerHTML = html;
}

function renderizarListaConfig() {
    const ul = document.getElementById('listaServicosConfig');
    if(!ul) return;
    
    ul.innerHTML = listaServicosLocal.map((s, index) => `
        <li class="item-servico" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; background: white; margin-bottom: 5px; border-radius: 8px;">
            <span style="font-weight: 600; color: var(--dark);">${s}</span>
            <div style="display: flex; gap: 8px;">
                <button class="btn-mini-edit" onclick="prepararEdicaoServico(${index})" style="background: #e3f2fd; color: #1976d2; border: none; padding: 5px 8px; border-radius: 6px; cursor: pointer;">
                    ✏️
                </button>
                <button class="btn-mini-del" onclick="removerServicoDaLista(${index})" style="background: #fff5f5; color: #ff4d4d; border: none; padding: 5px 8px; border-radius: 6px; cursor: pointer;">
                    🗑️
                </button>
            </div>
        </li>
    `).join('');
}

function prepararEdicaoServico(index) {
    const servicoTexto = listaServicosLocal[index]; // Ex: "Corte - R$ 35,00"
    
    let nome = servicoTexto;
    let preco = "";

    // Tenta separar o nome do preço se houver o padrão " - R$ "
    if (servicoTexto.includes(" - R$ ")) {
        const partes = servicoTexto.split(" - R$ ");
        nome = partes[0];
        preco = partes[1];
    }

    // Preenche os campos do topo do modal
    document.getElementById('novoServicoNome').value = nome;
    document.getElementById('novoServicoPreco').value = preco;

    // Remove o item da lista temporária para que, ao clicar em "Add", ele seja reinserido atualizado
    listaServicosLocal.splice(index, 1);
    
    // Atualiza a visão da lista
    renderizarListaConfig();
    
    // Foca no campo de nome para o usuário começar a digitar
    document.getElementById('novoServicoNome').focus();
    
    // Altera o texto do botão "Add" temporariamente para feedback visual
    const btnAdd = document.querySelector('.btn-add-servico');
    if(btnAdd) {
        btnAdd.textContent = "Atualizar";
        setTimeout(() => { btnAdd.textContent = "Add"; }, 3000);
    }
}


function editarServicoLista(index) {
    const servicoCompleto = listaServicosLocal[index]; // Ex: "Corte - R$ 35,00"
    
    // Tenta separar o nome do preço para preencher os inputs
    let nome = servicoCompleto;
    let preco = "";

    if (servicoCompleto.includes(" - R$ ")) {
        const partes = servicoCompleto.split(" - R$ ");
        nome = partes[0];
        preco = partes[1];
    }

    // Preenche os campos de input do modal
    document.getElementById('novoServicoNome').value = nome;
    document.getElementById('novoServicoPreco').value = preco;

    // Remove o item antigo da lista (para que ao clicar em 'Add' ele substitua)
    listaServicosLocal.splice(index, 1);
    atualizarListaServicosModal();
    
    // Foca no campo de nome para facilitar
    document.getElementById('novoServicoNome').focus();
}

function adicionarServicoLista() {
    const nomeEl = document.getElementById('novoServicoNome');
    const precoEl = document.getElementById('novoServicoPreco');
    
    if (nomeEl && precoEl) {
        const nome = nomeEl.value.trim();
        let preco = precoEl.value.trim();

        if (nome && preco) {
            preco = preco.replace(',', '.');
            const servicoFormatado = `${nome} - R$ ${preco}`;
            listaServicosLocal.push(servicoFormatado);
            renderizarListaConfig();
            atualizarSelectServicos();
            nomeEl.value = "";
            precoEl.value = "";
        }
    }
}

function removerServicoDaLista(index) {
    listaServicosLocal.splice(index, 1);
    renderizarListaConfig();
    atualizarSelectServicos();
}

async function salvarServicosNoGoogle() {
    exibirStatus("💾 Sincronizando...");
    try {
        await fetch(URL_WEB_APP, {
            method: 'POST',
            mode: 'no-cors', 
            body: JSON.stringify({ action: "updateServicos", servicos: listaServicosLocal }) 
        });
        exibirStatus("✅ Lista salva!");
        setTimeout(() => { fecharModalConfig(); listarHorarios(); }, 1500);
    } catch (e) {
        exibirStatus("❌ Erro ao conectar.");
    }
}

// Função para carregar os dados de uma vaga no formulário para edição
function prepararEdicao(item) {
    // 1. Abre o formulário se estiver fechado
    if (formContainer.classList.contains('hidden')) {
        toggleFormulario();
    }

    // 2. Define a linha que será editada (usada no momento do save)
    linhaSendoEditada = item.linha;

    // 3. Preenche os campos do formulário com os dados atuais
    const dataLimpa = item.data.includes('T') ? item.data.split('T')[0] : item.data;
    if (inputDataInicio) inputDataInicio.value = dataLimpa;
    if (inputDataFim) inputDataFim.value = dataLimpa;
    
    // Procura os elementos de hora e intervalo
    const hInicio = document.getElementById('horaInicio');
    const hFim = document.getElementById('horaFim');
    const intervalo = document.getElementById('intervalo');
    const servico = document.getElementById('servico');

    if (hInicio) hInicio.value = item.horario;
    if (servico) servico.value = item.servico || "";
    
    // 4. Muda o texto do botão para indicar edição
    if (btnSalvar) {
        btnSalvar.textContent = "Atualizar Horário";
        btnSalvar.style.backgroundColor = "#2dce89"; // Cor de sucesso/edição
    }

    // 5. Rola a página para o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    exibirStatus("📝 Editando horário da linha " + item.linha);
}
 
// ==========================================
// GERENCIAMENTO DE VAGAS (TELA 1)
// ==========================================

async function listarHorarios() {
    if (!corpoTabela) return;
    
    // Feedback visual de carregamento
    corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center;'>🔄 Atualizando agenda...</td></tr>";

    try {
        // O truque do timestamp (?t=...) força o navegador a buscar dados novos do Google
        const urlSemCache = `${URL_WEB_APP}${URL_WEB_APP.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
        
        const response = await fetch(urlSemCache);
        const data = await response.json(); 
        
        listaServicosLocal = data.servicos || [];
        atualizarSelectServicos();

        const agendamentos = data.horarios || [];
        corpoTabela.innerHTML = ""; 

        if (agendamentos.length === 0) {
            corpoTabela.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Nenhum horário cadastrado.</td></tr>";
            return;
        }

        const agora = new Date();

        // Inverte a lista para mostrar os mais recentes primeiro
        agendamentos.reverse().forEach(item => {
            // Tratamento da data para exibição PT-BR
            let dataExibicao = item.data;
            if (item.data.includes('-')) {
                const [ano, mes, dia] = item.data.split('-');
                dataExibicao = `${dia}/${mes}/${ano}`;
            }
            
            // Lógica para verificar se o horário já passou
            const [horas, minutos] = item.horario.split(':');
            const dataLimpa = item.data.includes('T') ? item.data.split('T')[0] : item.data;
            const dSplit = dataLimpa.includes('-') ? dataLimpa.split('-') : dataLimpa.split('/').reverse();
            const dataHoraItem = new Date(dSplit[0], dSplit[1] - 1, parseInt(dSplit[2]), parseInt(horas), parseInt(minutos));
            const jaPassou = dataHoraItem < agora;

            const row = document.createElement('tr');
            if (jaPassou) row.style.opacity = "0.5";

            const servicoTexto = item.servico || 'Disponível';
            const precoHTML = item.preco ? `<br><small style="color: #27ae60; font-weight: bold;">💰 R$ ${item.preco}</small>` : '';

            row.innerHTML = `
                <td><strong>${dataExibicao}</strong><br><span>às ${item.horario}</span></td>
                <td><span>${servicoTexto}</span>${precoHTML}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        ${jaPassou ? '🔒' : `<button class="btn-edit" onclick='prepararEdicao(${JSON.stringify(item)})' title="Editar">✏️</button>`}
                        <button class="btn-delete" onclick="deletarLinha(${item.linha})" title="Excluir">🗑️</button>
                    </div>
                </td>
            `;
            corpoTabela.appendChild(row);
        });
    } catch (error) {
        console.error("Erro ao listar:", error);
        corpoTabela.innerHTML = "<tr><td colspan='3' style='color:red; text-align:center;'>Erro ao carregar dados. Verifique a conexão.</td></tr>";
    }
}

async function deletarLinha(linha) {
    // 1. Confirmação para evitar exclusão acidental
    if (!confirm("⚠️ Tem certeza que deseja excluir permanentemente este horário da planilha?")) return;

    exibirStatus("🗑️ Excluindo...");

    try {
        // 2. Faz a chamada para o Google Apps Script via GET
        // O action 'liberarHorario' agora está configurado no seu .gs para deletar a linha
        const response = await fetch(`${URL_WEB_APP}?action=liberarHorario&linha=${linha}`);
        const resultado = await response.text();

        if (resultado.includes("Sucesso")) {
            exibirStatus("✅ Horário removido!");
            // 3. Atualiza a tabela localmente para sumir a linha
            listarHorarios();
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (e) {
        console.error("Erro ao deletar:", e);
        exibirStatus("❌ Erro ao conectar com o servidor.");
        alert("Não foi possível excluir. Verifique sua conexão ou o script do Google.");
    }
}

const cancelarAgendamento = deletarLinha;

// ==========================================
// AGENDA DE CLIENTES (TELA 2)
// ==========================================

function contarVisitas(whatsCliente, todosHorarios) {
    if (!whatsCliente || whatsCliente === "---") return 0;
    const whatsAtualLimpo = String(whatsCliente).replace(/\D/g, '');
    if (!whatsAtualLimpo) return 0;

    return todosHorarios.filter(h => {
        const whatsHistoricoLimpo = String(h.whatsapp).replace(/\D/g, '');
        return h.status === "Concluído" && whatsHistoricoLimpo === whatsAtualLimpo;
    }).length;
}

async function listarAgendaClientes() {
    const corpo = document.getElementById('corpoAgenda');
    if(!corpo) return;

    const filtroData = document.getElementById('filtroDataAgenda').value;
    const hoje = new Date().toLocaleDateString('en-CA');
    corpo.innerHTML = "<tr><td colspan='6' style='text-align:center;'>⏳ Carregando...</td></tr>";

    try {
        const res = await fetch(URL_WEB_APP); // Removido ?action=read para bater com o doGet
        const resultado = await res.json();
        const todosHorarios = resultado.horarios || [];

        const agendados = todosHorarios.filter(h => {
            const dataLimpa = h.data.includes('T') ? h.data.split('T')[0] : h.data;
            const statusValido = (h.status === "Ocupado" || h.status === "Concluído");
            return filtroData ? (statusValido && dataLimpa === filtroData) : statusValido;
        });

        agendados.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));

        if (agendados.length === 0) {
            corpo.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Nenhum agendamento encontrado.</td></tr>";
            return;
        }

        corpo.innerHTML = agendados.map(h => {
            const dataLimpa = h.data.includes('T') ? h.data.split('T')[0] : h.data;
            const foneLimpo = h.whatsapp ? String(h.whatsapp).replace(/\D/g, '') : '';
            const ehHoje = (dataLimpa === hoje);
            const dS = dataLimpa.split('-');
            const dataFormatada = dS.length === 3 ? `${dS[2]}/${dS[1]}` : dataLimpa;

            const totalVisitas = contarVisitas(h.whatsapp, todosHorarios);
            let badgeHTML = (totalVisitas === 0 && h.status !== 'Concluído') ? 
                `<span class="badge-novo">✨ CLIENTE NOVO</span>` : 
                `<small class="badge-visitas">👤 ${totalVisitas} visitas</small>`;

            const acoesHTML = h.status === 'Concluído' ? `
                <div class="btn-group-mobile">
                    <span class="txt-finalizado">✔️ Finalizado</span>
                    <button onclick="reabrirAtendimento(${h.linha})" class="btn-reabrir">⏪ Desfazer</button>
                </div>` : `
                <div class="btn-group-mobile">
                    <button onclick="concluirAtendimento(${h.linha})" class="btn-check">✅ Concluir</button>
                    <button onclick="deletarLinha(${h.linha})" class="btn-cancelar">❌ Cancelar</button>
                </div>`;

            return `
                <tr class="${ehHoje ? 'linha-hoje' : ''} ${h.status === 'Concluído' ? 'linha-concluida' : ''}">
                    <td data-label="📅 Data/Hora"><div class="mobile-info-main"><strong>${ehHoje ? '⭐ HOJE' : dataFormatada}</strong> <span class="hora-destaque">${h.horario}</span></div></td>
                    <td data-label="👤 Cliente"><div class="cliente-info"><strong>${h.cliente || '---'}</strong><br>${badgeHTML}</div></td>
                    <td data-label="✂️ Serviço"><span class="servico-texto">${h.servico || '---'}</span></td>
                    <td data-label="💰 Valor"><span style="color: #27ae60; font-weight: bold;">R$ ${h.preco || '0,00'}</span></td>
                    <td data-label="📱 Contato">${foneLimpo ? `<a href="https://wa.me/55${foneLimpo}" target="_blank" class="btn-whats-mobile">📱 WhatsApp</a>` : '---'}</td>
                    <td class="acoes-agenda">${acoesHTML}</td>
                </tr>`;
        }).join('');
    } catch (e) { 
        corpo.innerHTML = "<tr><td colspan='6' style='text-align:center; color:red;'>⚠️ Erro ao carregar agenda.</td></tr>"; 
    }
}

function exibirStatus(mensagem) {
    const sDiv = document.getElementById('status');
    if (sDiv) {
        sDiv.innerText = mensagem;
        sDiv.style.display = 'block';
        setTimeout(() => { sDiv.innerText = ''; }, 4000);
    }
}



async function reabrirAtendimento(linha) {
    if (!confirm("Deseja voltar para 'Agendado'?")) return;
    exibirStatus("⏳ Restaurando...");
    try {
        const res = await fetch(`${URL_WEB_APP}?action=updateStatus&linha=${linha}&status=Ocupado`);
        const result = await res.json();
        if (result.success) {
            exibirStatus("⏪ Restaurado!");
            listarAgendaClientes();
        }
    } catch (e) { exibirStatus("❌ Erro ao restaurar."); }
}

// FUNÇÃO PARA CANCELAR (EXCLUIR LINHA)
async function cancelarAtendimento(linha) {
    if (!confirm("⚠️ Confirmar cancelamento? O horário será removido permanentemente.")) return;

    exibirStatus("🗑️ Removendo da planilha...");

    try {
        // Envia o comando de deletar
        const response = await fetch(`${URL_WEB_APP}?action=liberarHorario&linha=${linha}`);
        const resultado = await response.text();

        if (resultado.includes("Sucesso")) {
            exibirStatus("✅ Cancelado!");

            // --- AQUI ACONTECE A ATUALIZAÇÃO DA TELA ---
            // Chamamos o listarHorarios() para redesenhar a tabela do zero
            if (typeof listarHorarios === "function") {
                await listarHorarios(); 
            }
        } else {
            alert("Erro ao excluir na planilha: " + resultado);
        }
    } catch (e) {
        console.error("Erro no cancelamento:", e);
        exibirStatus("❌ Erro de conexão.");
    }
}

// FUNÇÃO PARA CONCLUIR (MUDAR STATUS)
async function concluirAtendimento(linha) {
    exibirStatus("⏳ Concluindo...");
    try {
        const response = await fetch(`${URL_WEB_APP}?action=updateStatus&linha=${linha}&status=Concluído`);
        if (response.ok) {
            exibirStatus("✅ Concluído!");
            listarHorarios();
        }
    } catch (e) {
        console.error(e);
        exibirStatus("❌ Erro de conexão.");
    }
}

// ==========================================
// SUBMISSÃO DO FORMULÁRIO (GERAÇÃO EM MASSA)
// ==========================================

if(form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Referências locais para garantir que não haja erro de escopo
        const btn = document.getElementById('btnSalvar'); 
        const servicoSelecionado = document.getElementById('servico').value;
        const horaInicioInput = document.getElementById('horaInicio').value;

        // Criamos o objeto de dados (Payload) básico
        let payload = {
            servico: servicoSelecionado,
            linha: linhaSendoEditada // Esta variável deve ser global ou definida no PrepararEdicao
        };

        if (linhaSendoEditada) {
            // --- MODO EDIÇÃO ---
            payload.action = "edit";
            payload.horaInicio = horaInicioInput; 
        } else {
            // --- MODO CRIAÇÃO (GERAR VAGAS) ---
            const diasMarcados = Array.from(document.querySelectorAll('input[name="dia_sem"]:checked')).map(el => el.value);
            
            if (diasMarcados.length === 0) {
                alert("Selecione ao menos um dia da semana.");
                return;
            }

            payload.action = "save";
            payload.dias = diasMarcados;
            payload.dataInicio = document.getElementById('dataInicio').value;
            payload.dataFim = document.getElementById('dataFim').value;
            payload.horaInicio = horaInicioInput;
            payload.horaFim = document.getElementById('horaFim').value;
            payload.intervalo = document.getElementById('intervalo').value;
            payload.almocoInicio = document.getElementById('almocoInicio').value;
            payload.almocoFim = document.getElementById('almocoFim').value;
        }

        // Feedback visual
        btn.disabled = true;
        btn.textContent = "🚀 Processando...";
        exibirStatus("📡 Comunicando com o servidor...");

        try {
            // fetch para Google Apps Script com tratamento de CORS
            await fetch(URL_WEB_APP, {
                method: 'POST',
                mode: 'no-cors', // Fundamental para Google Apps Script POST
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Como o no-cors não permite ler a resposta, assumimos sucesso se não cair no catch
            exibirStatus("✅ Operação realizada!");
            
            setTimeout(() => {
                fecharELimparFormulario();
                // Pequeno delay extra antes de listar para dar tempo do Google processar
                setTimeout(listarHorarios, 500); 
            }, 1000);

        } catch (error) {
            console.error("Erro ao salvar:", error);
            btn.disabled = false;
            btn.textContent = "Tentar Novamente";
            exibirStatus("❌ Erro de conexão.");
        }
    });
}

function filtrarTabela() {
    const input = document.getElementById('inputBusca');
    if(!input) return;
    const termo = input.value.toLowerCase();
    const linhas = document.getElementById('corpoTabela').getElementsByTagName('tr');
    for (let i = 0; i < linhas.length; i++) {
        linhas[i].style.display = linhas[i].innerText.toLowerCase().includes(termo) ? "" : "none";
    }
}

// Inicialização
listarHorarios();

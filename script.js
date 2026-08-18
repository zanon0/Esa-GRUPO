/* =====================================
   MYSTUDY - Versão Final Corrigida
===================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBSMxEm9jfv0P8c2lJqPHLEdvmUVz-YHiw",
  authDomain: "grupo-esa-2027.firebaseapp.com",
  projectId: "grupo-esa-2027",
  storageBucket: "grupo-esa-2027.firebasestorage.app",
  messagingSenderId: "288746327635",
  appId: "1:288746327635:web:fbb19c27db74f135dcc0a6",
  measurementId: "G-5RN3G49501"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let usuarioAtual = null;
let segundosSessao = 0;
let intervalo = null;
let estudando = false;
let rankingAtual = [];
let semanaAtual = '';
let tempoEnviadoFirebase = 0;
let semanaAnteriorTotal = 0;
let semanaAtualTotal = 0;
let unsubscribeRanking = null;
let materiaAtual = '';
let graficoMaterias = null;

// =====================================
// INICIALIZAÇÃO
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await carregarDadosUsuario(user);
            abrirAplicativo();
        } else {
            if (unsubscribeRanking) {
                unsubscribeRanking();
                unsubscribeRanking = null;
            }
            document.getElementById("authScreen").classList.remove("hidden");
            document.getElementById("appScreen").classList.add("hidden");
        }
    });

    // Verifica mudança de semana a cada 5 minutos
    setInterval(verificarMudancaSemana, 300000);
});

// =====================================
// LOGIN
// =====================================

async function login() {
    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;
    const mensagem = document.getElementById("loginMensagem");

    if (!email || !senha) {
        mensagem.innerText = "Preencha e-mail e senha.";
        mensagem.style.color = "#ff7676";
        return;
    }

    try {
        mensagem.innerText = "Entrando...";
        mensagem.style.color = "#7ee787";
        await auth.signInWithEmailAndPassword(email, senha);
        mensagem.innerText = "Login realizado!";
        mensagem.style.color = "#7ee787";
    } catch (error) {
        console.error("Erro no login:", error);
        let msg = "Erro ao fazer login.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            msg = "E-mail ou senha incorretos.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "E-mail inválido.";
        } else if (error.code === 'auth/too-many-requests') {
            msg = "Muitas tentativas. Tente novamente mais tarde.";
        }
        mensagem.innerText = msg;
        mensagem.style.color = "#ff7676";
    }
}

// =====================================
// CARREGAR DADOS
// =====================================

async function carregarDadosUsuario(user) {
    try {
        const doc = await db.collection("usuarios").doc(user.uid).get();
        if (doc.exists) {
            usuarioAtual = { uid: user.uid, ...doc.data() };
        } else {
            const nome = user.displayName || user.email.split('@')[0];
            await db.collection("usuarios").doc(user.uid).set({
                uid: user.uid,
                nome: nome,
                email: user.email,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("ranking").doc(user.uid).set({
                uid: user.uid,
                nome: nome,
                tempo: 0,
                semana: obterSemanaAtual(),
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            });
            usuarioAtual = { uid: user.uid, nome: nome, email: user.email };
        }

        semanaAtual = obterSemanaAtual();
        await verificarMudancaSemana();
        configurarListenerRanking();
        await carregarTempoHoje();
        await carregarComparacaoSemanal();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        alert("Erro ao carregar seus dados. Tente recarregar a página.");
    }
}

// =====================================
// ABRIR APLICATIVO
// =====================================

function abrirAplicativo() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    document.getElementById("usuarioNome").innerText = usuarioAtual.nome;
    document.getElementById("menuUsuario").innerText = usuarioAtual.nome;
    document.getElementById("nomeWelcome").innerText = usuarioAtual.nome;
    atualizarInterface();
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
    if (estudando) {
        alert("Finalize sua sessão de estudos antes de sair.");
        return;
    }
    try {
        if (unsubscribeRanking) {
            unsubscribeRanking();
            unsubscribeRanking = null;
        }
        await auth.signOut();
        usuarioAtual = null;
        if (intervalo) { clearInterval(intervalo); intervalo = null; }
        segundosSessao = 0;
        estudando = false;
        rankingAtual = [];
        document.getElementById("appScreen").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
        document.getElementById("timer").innerText = "00:00:00";
        document.getElementById("statusTimer").innerText = "✅ Pronto para estudar";
        document.getElementById("startButton").innerText = "▶ Iniciar";
        document.getElementById("startButton").style.background = "#4CAF50";
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
}

// =====================================
// MENU
// =====================================

function abrirMenu() {
    document.getElementById("sideMenu").classList.add("open");
    document.getElementById("menuOverlay").classList.remove("hidden");
}

function fecharMenu() {
    document.getElementById("sideMenu").classList.remove("open");
    document.getElementById("menuOverlay").classList.add("hidden");
}

// =====================================
// TROCAR PÁGINA
// =====================================

function mostrarPagina(pagina) {
    fecharMenu();
    document.getElementById("paginaCronometro").classList.add("hidden");
    document.getElementById("paginaRanking").classList.add("hidden");
    document.getElementById("paginaHistorico").classList.add("hidden");
    document.getElementById("paginaEstatisticas").classList.add("hidden");

    if (pagina === "cronometro") {
        document.getElementById("paginaCronometro").classList.remove("hidden");
        carregarComparacaoSemanal();
    } else if (pagina === "ranking") {
        document.getElementById("paginaRanking").classList.remove("hidden");
        atualizarRanking();
    } else if (pagina === "historico") {
        document.getElementById("paginaHistorico").classList.remove("hidden");
        definirDataPadrao();
        carregarHistorico();
    } else if (pagina === "estatisticas") {
        document.getElementById("paginaEstatisticas").classList.remove("hidden");
        carregarEstatisticas();
    }
}

// =====================================
// MODAL DE MATÉRIA
// =====================================

function iniciar() {
    if (!usuarioAtual) {
        alert("Faça login primeiro!");
        return;
    }
    
    if (estudando) {
        return;
    }

    // Abre o modal para digitar a matéria
    document.getElementById("modalMateria").classList.remove("hidden");
    document.getElementById("materiaInput").value = "";
    document.getElementById("modalMensagem").innerText = "";
    document.getElementById("materiaInput").focus();
}

function cancelarInicio() {
    document.getElementById("modalMateria").classList.add("hidden");
    materiaAtual = '';
    document.getElementById("statusTimer").innerText = "✅ Pronto para estudar";
    document.getElementById("startButton").innerText = "▶ Iniciar";
}

function confirmarInicio() {
    const materia = document.getElementById("materiaInput").value.trim();
    if (!materia) {
        document.getElementById("modalMensagem").innerText = "Digite o nome da matéria!";
        document.getElementById("modalMensagem").style.color = "#ff7676";
        return;
    }

    materiaAtual = materia;
    document.getElementById("modalMateria").classList.add("hidden");
    
    // Exibe a matéria atual
    document.getElementById("materiaAtualTexto").innerText = materiaAtual;
    document.getElementById("materiaAtualDisplay").classList.remove("hidden");
    
    // Inicia o cronômetro
    tempoEnviadoFirebase = 0;
    estudando = true;
    document.getElementById("statusTimer").innerText = "🎯 Estudando " + materiaAtual + "...";
    document.getElementById("startButton").innerText = "● Estudando";
    document.getElementById("startButton").style.background = "#4CAF50";

    if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
    }

    intervalo = setInterval(async () => {
        segundosSessao++;
        atualizarTimer();

        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff >= 5) {
            await atualizarTempoFirebase(diff);
            tempoEnviadoFirebase = segundosSessao;
        }
    }, 1000);
}

function pausar() {
    if (!estudando) {
        return;
    }

    if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
    }
    
    estudando = false;
    document.getElementById("statusTimer").innerText = "⏸️ Estudo pausado";
    document.getElementById("startButton").innerText = "▶ Continuar";
    document.getElementById("startButton").style.background = "#FFA500";
}

async function encerrar() {
    if (!usuarioAtual) {
        return;
    }

    if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
    }

    if (segundosSessao > 0) {
        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff > 0) {
            await atualizarTempoFirebase(diff);
        }

        try {
            // Salva no histórico com os novos campos
            const agora = new Date();
            await db.collection("historico").add({
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                materia: materiaAtual,
                tempo: segundosSessao,
                data: agora.toLocaleDateString("pt-BR"),
                dataISO: agora.toISOString().split('T')[0],
                horaInicio: agora.toLocaleTimeString("pt-BR"),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Sessão salva:", segundosSessao, "segundos -", materiaAtual);
            
            // Atualiza as estatísticas
            await carregarEstatisticas();
            await carregarTempoHoje();
            await carregarComparacaoSemanal();

        } catch (error) {
            console.error("❌ Erro ao salvar sessão:", error);
        }
    }

    segundosSessao = 0;
    tempoEnviadoFirebase = 0;
    estudando = false;
    materiaAtual = '';

    document.getElementById("statusTimer").innerText = "✅ Pronto para estudar";
    document.getElementById("startButton").innerText = "▶ Iniciar";
    document.getElementById("startButton").style.background = "#4CAF50";
    document.getElementById("materiaAtualDisplay").classList.add("hidden");
    atualizarTimer();
    atualizarInterface();
}

function atualizarTimer() {
    const h = Math.floor(segundosSessao / 3600);
    const m = Math.floor((segundosSessao % 3600) / 60);
    const s = segundosSessao % 60;
    document.getElementById("timer").innerText = `${formatar(h)}:${formatar(m)}:${formatar(s)}`;
}

function formatar(numero) { 
    return String(numero).padStart(2, "0"); 
}

// =====================================
// ATUALIZAR TEMPO NO FIREBASE
// =====================================

async function atualizarTempoFirebase(tempoAdicional) {
    if (!usuarioAtual || tempoAdicional <= 0) return;
    try {
        const docRef = db.collection("ranking").doc(usuarioAtual.uid);
        const doc = await docRef.get();
        const semanaAtual = obterSemanaAtual();

        if (doc.exists) {
            const data = doc.data();
            if (data.semana !== semanaAtual) {
                await docRef.update({
                    tempo: tempoAdicional,
                    semana: semanaAtual,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await docRef.update({
                    tempo: firebase.firestore.FieldValue.increment(tempoAdicional),
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            await docRef.set({
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                tempo: tempoAdicional,
                semana: semanaAtual,
                ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Erro ao atualizar ranking:", error);
    }
}

// =====================================
// VERIFICA MUDANÇA DE SEMANA
// =====================================

async function verificarMudancaSemana() {
    if (!usuarioAtual) return;
    try {
        const semanaAtual = obterSemanaAtual();
        const docRef = db.collection("ranking").doc(usuarioAtual.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.semana !== semanaAtual) {
                await docRef.update({
                    tempo: 0,
                    semana: semanaAtual,
                    ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log("🔄 Ranking zerado para nova semana:", semanaAtual);
                await carregarComparacaoSemanal();
            }
        }
    } catch (error) {
        console.error("Erro ao verificar mudança de semana:", error);
    }
}

// =====================================
// LISTENER RANKING EM TEMPO REAL
// =====================================

function configurarListenerRanking() {
    if (unsubscribeRanking) {
        unsubscribeRanking();
    }
    unsubscribeRanking = db.collection("ranking")
        .where("semana", "==", obterSemanaAtual())
        .onSnapshot((snapshot) => {
            rankingAtual = [];
            snapshot.forEach(doc => {
                rankingAtual.push({ id: doc.id, ...doc.data() });
            });
            rankingAtual.sort((a, b) => b.tempo - a.tempo);
            atualizarRanking();
        }, (error) => {
            console.error("Erro no listener do ranking:", error);
        });
}

// =====================================
// RANKING
// =====================================

function atualizarRanking() {
    const lista = document.getElementById("listaRanking");
    if (!lista) return;

    lista.innerHTML = "";

    if (rankingAtual.length === 0) {
        lista.innerHTML = `
            <div class="ranking-row">
                <span class="col-posicao">-</span>
                <span class="col-nome">Nenhum registro esta semana</span>
                <span class="col-tempo">0min</span>
            </div>
        `;
        return;
    }

    rankingAtual.forEach((jogador, index) => {
        const linha = document.createElement("div");
        linha.className = "ranking-row";

        if (index === 0) linha.classList.add("posicao-1");
        else if (index === 1) linha.classList.add("posicao-2");
        else if (index === 2) linha.classList.add("posicao-3");

        if (usuarioAtual && jogador.uid === usuarioAtual.uid) {
            linha.classList.add("destaque");
        }

        const nome = jogador.nome || jogador.uid || "Anônimo";
        const medalha = obterMedalha(index);
        const tempo = formatarTempo(jogador.tempo || 0);

        linha.innerHTML = `
            <span class="col-posicao ranking-position">${medalha}</span>
            <span class="col-nome ranking-name">${escaparHTML(nome)}</span>
            <span class="col-tempo ranking-time">${tempo}</span>
        `;

        lista.appendChild(linha);
    });

    atualizarPosicao();
}

function obterMedalha(posicao) {
    if (posicao === 0) return "🥇";
    if (posicao === 1) return "🥈";
    if (posicao === 2) return "🥉";
    return `${posicao + 1}º`;
}

function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) return `${horas}h ${String(minutos).padStart(2, "0")}min`;
    return `${minutos}min`;
}

function formatarTempoCompleto(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    if (h > 0) return `${h}h ${m}min ${s}s`;
    if (m > 0) return `${m}min ${s}s`;
    return `${s}s`;
}

function atualizarPosicao() {
    if (!usuarioAtual) return;
    const posicao = rankingAtual.findIndex(r => r.uid === usuarioAtual.uid);
    const elemento = document.getElementById("posicaoAtual");
    if (posicao === -1 || rankingAtual.length === 0) {
        elemento.innerText = "-";
    } else {
        elemento.innerText = `${posicao + 1}º`;
    }
}

// =====================================
// HISTÓRICO COM SELETOR DE DATA
// =====================================

function definirDataPadrao() {
    const hoje = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById("historyDate");
    if (!inputData.value) {
        inputData.value = hoje;
    }
}

async function carregarHistorico() {
    if (!usuarioAtual) return;
    
    const dataSelecionada = document.getElementById("historyDate").value;
    if (!dataSelecionada) {
        document.getElementById("listaHistorico").innerHTML = 
            `<div class="history-row"><span class="history-date">📅 Selecione uma data para visualizar o histórico.</span></div>`;
        return;
    }

    try {
        const snapshot = await db.collection("historico")
            .where("uid", "==", usuarioAtual.uid)
            .where("dataISO", "==", dataSelecionada)
            .get();

        const historico = [];
        snapshot.forEach(doc => {
            historico.push({ id: doc.id, ...doc.data() });
        });

        // Ordena por hora de início
        historico.sort((a, b) => {
            const horaA = a.horaInicio || '';
            const horaB = b.horaInicio || '';
            return horaA.localeCompare(horaB);
        });

        atualizarHistorico(historico, dataSelecionada);
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        document.getElementById("listaHistorico").innerHTML = 
            `<div class="history-row"><span class="history-date">❌ Erro ao carregar histórico.</span></div>`;
    }
}

function atualizarHistorico(historico, dataSelecionada) {
    const lista = document.getElementById("listaHistorico");
    if (!lista) return;

    lista.innerHTML = "";

    if (!historico || historico.length === 0) {
        const dataFormatada = new Date(dataSelecionada + 'T00:00:00').toLocaleDateString('pt-BR');
        lista.innerHTML = `
            <div class="history-row">
                <span class="history-date">📭 Nenhuma sessão registrada em ${dataFormatada}.</span>
            </div>
        `;
        return;
    }

    // Calcula total do dia
    let totalDia = 0;
    historico.forEach(sessao => {
        totalDia += sessao.tempo || 0;
    });

    // Cabeçalho com total
    const headerRow = document.createElement("div");
    headerRow.className = "history-row";
    headerRow.style.background = "#292929";
    headerRow.style.borderLeft = "3px solid #4CAF50";
    headerRow.innerHTML = `
        <div class="history-info">
            <span class="history-date">📊 Total do dia: ${historico.length} sessão(ões)</span>
        </div>
        <span class="history-time">${formatarTempoCompleto(totalDia)}</span>
    `;
    lista.appendChild(headerRow);

    historico.forEach((sessao) => {
        const div = document.createElement("div");
        div.className = "history-row";
        div.innerHTML = `
            <div class="history-info">
                <span class="history-materia">📚 ${escaparHTML(sessao.materia || 'Sem matéria')}</span>
                <span class="history-date">🕐 ${sessao.horaInicio || 'Horário não disponível'}</span>
            </div>
            <span class="history-time">${formatarTempoCompleto(sessao.tempo || 0)}</span>
        `;
        lista.appendChild(div);
    });
}

// =====================================
// ESTATÍSTICAS
// =====================================

async function carregarEstatisticas() {
    if (!usuarioAtual) return;

    try {
        const snapshot = await db.collection("historico")
            .where("uid", "==", usuarioAtual.uid)
            .get();

        const sessoes = [];
        snapshot.forEach(doc => {
            sessoes.push({ id: doc.id, ...doc.data() });
        });

        // Calcula estatísticas
        const totalSegundos = sessoes.reduce((acc, s) => acc + (s.tempo || 0), 0);
        const totalSessoes = sessoes.length;
        
        // Agrupa por matéria
        const materiasMap = {};
        sessoes.forEach(sessao => {
            const materia = sessao.materia || 'Sem matéria';
            if (!materiasMap[materia]) {
                materiasMap[materia] = 0;
            }
            materiasMap[materia] += sessao.tempo || 0;
        });

        // Encontra matéria mais estudada
        let materiaFavorita = '-';
        let maxTempo = 0;
        Object.entries(materiasMap).forEach(([materia, tempo]) => {
            if (tempo > maxTempo) {
                maxTempo = tempo;
                materiaFavorita = materia;
            }
        });

        // Atualiza interface
        document.getElementById("statTotalHoras").innerText = formatarHoras(totalSegundos);
        document.getElementById("statTotalSessoes").innerText = totalSessoes;
        document.getElementById("statMateriaFavorita").innerText = materiaFavorita;

        // Atualiza lista de tempo por matéria
        atualizarListaMaterias(materiasMap);

        // Atualiza gráfico
        atualizarGraficoMaterias(materiasMap);

    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
    }
}

function formatarHoras(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) {
        return `${horas}h ${minutos}min`;
    }
    return `${minutos}min`;
}

function atualizarListaMaterias(materiasMap) {
    const lista = document.getElementById("listaTempoPorMateria");
    if (!lista) return;

    lista.innerHTML = "";

    // Ordena por tempo (decrescente)
    const materiasOrdenadas = Object.entries(materiasMap).sort((a, b) => b[1] - a[1]);

    if (materiasOrdenadas.length === 0) {
        lista.innerHTML = `
            <div class="materia-stat-row">
                <span class="materia-stat-nome">Nenhuma matéria estudada ainda</span>
                <span class="materia-stat-tempo">0min</span>
            </div>
        `;
        return;
    }

    materiasOrdenadas.forEach(([materia, tempo]) => {
        const div = document.createElement("div");
        div.className = "materia-stat-row";
        div.innerHTML = `
            <span class="materia-stat-nome">📚 ${escaparHTML(materia)}</span>
            <span class="materia-stat-tempo">${formatarTempo(tempo)}</span>
        `;
        lista.appendChild(div);
    });
}

function atualizarGraficoMaterias(materiasMap) {
    const canvas = document.getElementById("graficoMaterias");
    if (!canvas) return;

    // Destroi gráfico anterior se existir
    if (graficoMaterias) {
        graficoMaterias.destroy();
    }

    const materias = Object.keys(materiasMap);
    const temposHoras = Object.values(materiasMap).map(segundos => (segundos / 3600).toFixed(2));

    if (materias.length === 0) {
        // Cria gráfico vazio
        graficoMaterias = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Nenhuma matéria'],
                datasets: [{
                    label: 'Horas estudadas',
                    data: [0],
                    backgroundColor: '#4CAF50',
                    borderColor: '#45a049',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#888'
                        },
                        grid: {
                            color: '#2a2a2a'
                        },
                        title: {
                            display: true,
                            text: 'Horas',
                            color: '#888'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#888'
                        },
                        grid: {
                            color: '#2a2a2a'
                        }
                    }
                }
            }
        });
        return;
    }

    graficoMaterias = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: materias,
            datasets: [{
                label: 'Horas estudadas',
                data: temposHoras,
                backgroundColor: [
                    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', 
                    '#F44336', '#00BCD4', '#FFEB3B', '#795548'
                ],
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + ' horas';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#888',
                        callback: function(value) {
                            return value + 'h';
                        }
                    },
                    grid: {
                        color: '#2a2a2a'
                    },
                    title: {
                        display: true,
                        text: 'Horas',
                        color: '#888'
                    }
                },
                x: {
                    ticks: {
                        color: '#888'
                    },
                    grid: {
                        color: '#2a2a2a'
                    }
                }
            }
        }
    });
}

// =====================================
// COMPARAÇÃO SEMANAL
// =====================================

async function carregarComparacaoSemanal() {
    if (!usuarioAtual) return;
    try {
        const semanaPassada = obterSemanaAnterior();
        const semanaAtualStr = obterSemanaAtual();

        const snapshotAtual = await db.collection("ranking")
            .where("uid", "==", usuarioAtual.uid)
            .where("semana", "==", semanaAtualStr)
            .get();
        let tempoAtual = 0;
        snapshotAtual.forEach(doc => { tempoAtual = doc.data().tempo || 0; });

        const snapshotAnterior = await db.collection("ranking")
            .where("uid", "==", usuarioAtual.uid)
            .where("semana", "==", semanaPassada)
            .get();
        let tempoAnterior = 0;
        snapshotAnterior.forEach(doc => { tempoAnterior = doc.data().tempo || 0; });

        semanaAtualTotal = tempoAtual;
        semanaAnteriorTotal = tempoAnterior;

        let comparacao = "";
        if (tempoAnterior === 0 && tempoAtual === 0) {
            comparacao = "📊 Comece a estudar esta semana!";
        } else if (tempoAnterior === 0 && tempoAtual > 0) {
            comparacao = "🚀 Primeira semana! Continue assim!";
        } else if (tempoAtual > tempoAnterior) {
            const aumento = ((tempoAtual - tempoAnterior) / tempoAnterior) * 100;
            comparacao = `📈 ${Math.round(aumento)}% a mais que semana passada! 🎉`;
        } else if (tempoAtual < tempoAnterior) {
            const queda = ((tempoAnterior - tempoAtual) / tempoAnterior) * 100;
            comparacao = `📉 ${Math.round(queda)}% a menos que semana passada. Bora recuperar! 💪`;
        } else {
            comparacao = "⚖️ Mesmo tempo da semana passada!";
        }

        const comparacaoElement = document.getElementById("comparacaoSemanal");
        if (comparacaoElement) {
            comparacaoElement.innerHTML = `
                <div class="comparacao-semanal">
                    <div class="comparacao-grid">
                        <div class="comparacao-item">
                            <span class="label">Semana passada</span>
                            <span class="valor anterior">${formatarTempo(tempoAnterior)}</span>
                        </div>
                        <div class="comparacao-vs">vs</div>
                        <div class="comparacao-item">
                            <span class="label">Esta semana</span>
                            <span class="valor atual">${formatarTempo(tempoAtual)}</span>
                        </div>
                    </div>
                    <div class="comparacao-resultado ${tempoAtual >= tempoAnterior ? 'positivo' : 'negativo'}">${comparacao}</div>
                    <div class="comparacao-info">⏰ Reset automático toda segunda-feira</div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Erro ao carregar comparação:", error);
    }
}

// =====================================
// ESTATÍSTICAS RÁPIDAS (HOJE)
// =====================================

async function carregarTempoHoje() {
    if (!usuarioAtual) return;
    try {
        const hoje = new Date().toLocaleDateString("pt-BR");
        const snapshot = await db.collection("historico")
            .where("uid", "==", usuarioAtual.uid)
            .where("data", "==", hoje)
            .get();
        let total = 0;
        snapshot.forEach(doc => { total += doc.data().tempo || 0; });
        document.getElementById("tempoHoje").innerText = formatarTempo(total);
    } catch (error) {
        console.error("Erro ao carregar tempo de hoje:", error);
    }
}

function atualizarInterface() {
    if (!usuarioAtual) return;
    const meuRanking = rankingAtual.find(r => r.uid === usuarioAtual.uid);
    if (meuRanking) {
        document.getElementById("tempoSemana").innerText = formatarTempo(meuRanking.tempo || 0);
    }
    atualizarPosicao();
}

// =====================================
// UTILITÁRIOS
// =====================================

function obterSemanaAtual() {
    const data = new Date();
    const alvo = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
    const diaNum = alvo.getUTCDay() || 7;
    alvo.setUTCDate(alvo.getUTCDate() + 4 - diaNum);
    const anoInicio = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 1));
    const semana = Math.ceil((((alvo - anoInicio) / 86400000) + 1) / 7);
    return `${alvo.getUTCFullYear()}-${String(semana).padStart(2, '0')}`;
}

function obterSemanaAnterior() {
    const data = new Date();
    data.setDate(data.getDate() - 7);
    const alvo = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
    const diaNum = alvo.getUTCDay() || 7;
    alvo.setUTCDate(alvo.getUTCDate() + 4 - diaNum);
    const anoInicio = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 1));
    const semana = Math.ceil((((alvo - anoInicio) / 86400000) + 1) / 7);
    return `${alvo.getUTCFullYear()}-${String(semana).padStart(2, '0')}`;
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

console.log("✅ MyStudy inicializado com sucesso!");
console.log("📊 Estatísticas e gráficos ativos!");
console.log("⏰ Reset semanal automático!");

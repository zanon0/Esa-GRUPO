/* =====================================
   MYSTUDY - Versão Firebase
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
// VARIÁVEIS
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

// =====================================
// INICIALIZAÇÃO
// =====================================

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await carregarDadosUsuario(user);
            abrirAplicativo();
        } else {
            document.getElementById("authScreen").classList.remove("hidden");
            document.getElementById("appScreen").classList.add("hidden");
        }
    });
    setInterval(verificarResetSemanal, 60000);
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
        mensagem.innerText = "E-mail ou senha incorretos.";
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
                semana: obterSemanaAtual()
            });
            usuarioAtual = { uid: user.uid, nome: nome, email: user.email };
        }

        semanaAtual = obterSemanaAtual();
        await carregarRanking();
        await carregarHistorico();
        await carregarTempoHoje();
        await carregarComparacaoSemanal();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
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
        await auth.signOut();
        usuarioAtual = null;
        if (intervalo) { clearInterval(intervalo); intervalo = null; }
        segundosSessao = 0;
        estudando = false;
        document.getElementById("appScreen").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
        document.getElementById("timer").innerText = "00:00:00";
        document.getElementById("statusTimer").innerText = "Pronto para estudar";
        document.getElementById("startButton").innerText = "▶ Iniciar";
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

function mostrarPagina(pagina) {
    fecharMenu();
    document.getElementById("paginaCronometro").classList.add("hidden");
    document.getElementById("paginaRanking").classList.add("hidden");
    document.getElementById("paginaHistorico").classList.add("hidden");

    if (pagina === "cronometro") {
        document.getElementById("paginaCronometro").classList.remove("hidden");
        carregarComparacaoSemanal();
    } else if (pagina === "ranking") {
        document.getElementById("paginaRanking").classList.remove("hidden");
        carregarRanking();
    } else if (pagina === "historico") {
        document.getElementById("paginaHistorico").classList.remove("hidden");
        carregarHistorico();
    }
}

// =====================================
// CRONÔMETRO
// =====================================

function iniciar() {
    if (!usuarioAtual || estudando) return;
    estudando = true;
    tempoEnviadoFirebase = 0;
    document.getElementById("statusTimer").innerText = "Estudando agora...";
    document.getElementById("startButton").innerText = "● Estudando";

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
    if (!estudando) return;
    clearInterval(intervalo);
    intervalo = null;
    estudando = false;
    document.getElementById("statusTimer").innerText = "Estudo pausado";
    document.getElementById("startButton").innerText = "▶ Continuar";
}

async function encerrar() {
    if (!usuarioAtual) return;
    clearInterval(intervalo);
    intervalo = null;

    if (segundosSessao > 0) {
        const diff = segundosSessao - tempoEnviadoFirebase;
        if (diff > 0) { await atualizarTempoFirebase(diff); }
        try {
            await db.collection("historico").add({
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                tempo: segundosSessao,
                data: new Date().toLocaleDateString("pt-BR"),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await carregarRanking();
            await carregarHistorico();
            await carregarTempoHoje();
            await carregarComparacaoSemanal();
        } catch (error) {
            console.error("Erro ao salvar sessão:", error);
        }
    }
    segundosSessao = 0;
    estudando = false;
    document.getElementById("statusTimer").innerText = "Sessão encerrada";
    document.getElementById("startButton").innerText = "▶ Iniciar";
    atualizarTimer();
    atualizarInterface();
}

function atualizarTimer() {
    const h = Math.floor(segundosSessao / 3600);
    const m = Math.floor((segundosSessao % 3600) / 60);
    const s = segundosSessao % 60;
    document.getElementById("timer").innerText = `${formatar(h)}:${formatar(m)}:${formatar(s)}`;
}

function formatar(numero) { return String(numero).padStart(2, "0"); }

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

        // TOP 3
        if (index === 0) {
            linha.classList.add("posicao-1");
        } else if (index === 1) {
            linha.classList.add("posicao-2");
        } else if (index === 2) {
            linha.classList.add("posicao-3");
        }

        // DESTAQUE USUÁRIO ATUAL
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
// =====================================
// HISTÓRICO
// =====================================

async function carregarHistorico() {
    if (!usuarioAtual) return;
    try {
        const snapshot = await db.collection("historico").where("uid", "==", usuarioAtual.uid).get();
        const historico = [];
        snapshot.forEach(doc => { historico.push({ id: doc.id, ...doc.data() }); });
        historico.sort((a, b) => {
            if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
            return 0;
        });
        atualizarHistorico(historico.slice(0, 50));
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
    }
}

function atualizarHistorico(historico) {
    const lista = document.getElementById("listaHistorico");
    if (!lista) return;
    lista.innerHTML = "";
    if (!historico || historico.length === 0) {
        lista.innerHTML = `<div class="history-row"><span class="history-date">📭 Nenhuma sessão registrada.</span></div>`;
        return;
    }
    historico.forEach((sessao, index) => {
        const div = document.createElement("div");
        div.className = "history-row";
        if (index === 0) { div.style.background = "#292929"; div.style.borderLeft = "3px solid #4CAF50"; }
        div.innerHTML = `
            <span class="history-date">${sessao.data || 'Data não disponível'}</span>
            <span class="history-time">${formatarTempoCompleto(sessao.tempo || 0)}</span>
        `;
        lista.appendChild(div);
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

        const snapshotAtual = await db.collection("ranking").where("uid", "==", usuarioAtual.uid).where("semana", "==", semanaAtualStr).get();
        let tempoAtual = 0;
        snapshotAtual.forEach(doc => { tempoAtual = doc.data().tempo || 0; });

        const snapshotAnterior = await db.collection("ranking").where("uid", "==", usuarioAtual.uid).where("semana", "==", semanaPassada).get();
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
                    <div class="comparacao-info">⏰ Reset automático todo domingo às 23:59</div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Erro ao carregar comparação:", error);
    }
}

// =====================================
// RESET SEMANAL
// =====================================

function verificarResetSemanal() {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const hora = agora.getHours();
    const minutos = agora.getMinutes();
    if (diaSemana === 0 && hora === 23 && minutos === 59) {
        resetarRankingSemanal();
    }
}

async function resetarRankingSemanal() {
    try {
        const snapshot = await db.collection("ranking").where("semana", "==", semanaAtual).get();
        const batch = db.batch();
        const promessas = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            promessas.push(db.collection("historico_semanal").add({
                uid: data.uid, nome: data.nome, tempo: data.tempo || 0,
                semana: semanaAtual, dataSalvo: firebase.firestore.FieldValue.serverTimestamp()
            }));
            batch.update(doc.ref, { tempo: 0, semana: obterSemanaAtual(), ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await Promise.all(promessas);
        await batch.commit();
        await carregarRanking();
        await carregarComparacaoSemanal();
        alert(`📊 SEMANA FINALIZADA!\n\nVocê estudou ${formatarTempo(semanaAtualTotal)} esta semana!\nSemana passada: ${formatarTempo(semanaAnteriorTotal)}\n\nNovo ranking começou! Bora estudar! 💪`);
        location.reload();
    } catch (error) {
        console.error("Erro ao resetar ranking:", error);
    }
}

// =====================================
// ESTATÍSTICAS
// =====================================

async function carregarTempoHoje() {
    if (!usuarioAtual) return;
    try {
        const hoje = new Date().toLocaleDateString("pt-BR");
        const snapshot = await db.collection("historico").where("uid", "==", usuarioAtual.uid).where("data", "==", hoje).get();
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
    const primeiroDia = new Date(data.getFullYear(), 0, 1);
    const dias = Math.floor((data - primeiroDia) / 86400000);
    return data.getFullYear() + "-" + Math.ceil((dias + primeiroDia.getDay() + 1) / 7);
}

function obterSemanaAnterior() {
    const data = new Date();
    data.setDate(data.getDate() - 7);
    const primeiroDia = new Date(data.getFullYear(), 0, 1);
    const dias = Math.floor((data - primeiroDia) / 86400000);
    return data.getFullYear() + "-" + Math.ceil((dias + primeiroDia.getDay() + 1) / 7);
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

setInterval(() => {
    if (usuarioAtual) {
        carregarRanking();
        carregarComparacaoSemanal();
    }
}, 30000);

console.log("✅ MyStudy inicializado!");
console.log("📊 Ranking semanal ativo!");
console.log("⏰ Reset automático: DOMINGO 23:59");

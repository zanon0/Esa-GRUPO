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
// PLAYER DE MÚSICA COM VOLUME
// =====================================

let currentMusicIndex = 0;
let player = null;
let isPlaying = false;

// Playlist de músicas
const playlist = [
    {
        title: "🎵 Deep Focus - Interstellar",
        videoId: "hUUBG_Nlwh4"
    },
    {
        title: "🎵 Zen Mode - Calm Productivity",
        videoId: "Uhmq6gmLpGQ"
    },
    {
        title: "🎵 Classical Music for Study",
        videoId: "4jO2D2w0N_E"
    },
    {
        title: "🎵 Deep Work Music",
        videoId: "lTRiuFIWV54"
    },
    {
        title: "🎵 Focus & Concentration",
        videoId: "jfKfPfyJRdk"
    },
    {
        title: "🎵 Study with Me",
        videoId: "5yx6BWlEVcY"
    },
    {
        title: "🎵 Chill Study Beats",
        videoId: "rUxyKA_-grg"
    }
];

// Carrega a API do YouTube
function carregarYouTubeAPI() {
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Função chamada quando a API do YouTube carrega
function onYouTubeIframeAPIReady() {
    carregarMusica(currentMusicIndex);
}

function carregarMusica(index) {
    const musica = playlist[index];
    if (!musica) return;

    document.getElementById('musicTitle').innerText = musica.title;

    if (player) {
        player.loadVideoById(musica.videoId);
        // Aplica o volume atual
        const volumeValue = document.getElementById('volumeSlider').value;
        player.setVolume(parseInt(volumeValue));
    } else {
        player = new YT.Player('youtubePlayer', {
            height: '0',
            width: '0',
            videoId: musica.videoId,
            playerVars: {
                volume: parseInt(document.getElementById('volumeSlider').value)
            },
            events: {
                onReady: (event) => {
                    if (isPlaying) {
                        event.target.playVideo();
                    }
                    // Aplica o volume inicial
                    const volumeValue = document.getElementById('volumeSlider').value;
                    event.target.setVolume(parseInt(volumeValue));
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        nextMusic();
                    }
                }
            }
        });
    }
}

function togglePlayPause() {
    if (!player) return;
    
    if (isPlaying) {
        player.pauseVideo();
        document.getElementById('playPauseBtn').innerText = '▶️';
        isPlaying = false;
    } else {
        player.playVideo();
        document.getElementById('playPauseBtn').innerText = '⏸️';
        isPlaying = true;
    }
}

function nextMusic() {
    currentMusicIndex = (currentMusicIndex + 1) % playlist.length;
    carregarMusica(currentMusicIndex);
    if (isPlaying) {
        setTimeout(() => {
            if (player) player.playVideo();
        }, 500);
    }
}

// =====================================
// CONTROLE DE VOLUME
// =====================================

function ajustarVolume(valor) {
    const volume = parseInt(valor);
    document.getElementById('volumeValue').innerText = volume + '%';
    
    // Muda o ícone do volume
    const icon = document.querySelector('.volume-icon');
    if (volume === 0) {
        icon.innerText = '🔇';
    } else if (volume < 30) {
        icon.innerText = '🔈';
    } else if (volume < 70) {
        icon.innerText = '🔉';
    } else {
        icon.innerText = '🔊';
    }
    
    // Aplica o volume no player
    if (player) {
        player.setVolume(volume);
    }
}

// =====================================
// VOLUME POR TECLADO
// =====================================

document.addEventListener('keydown', (event) => {
    const slider = document.getElementById('volumeSlider');
    
    // Seta para cima = aumentar volume
    if (event.key === 'ArrowUp' && event.ctrlKey) {
        event.preventDefault();
        let novoValor = parseInt(slider.value) + 10;
        if (novoValor > 100) novoValor = 100;
        slider.value = novoValor;
        ajustarVolume(novoValor);
    }
    
    // Seta para baixo = diminuir volume
    if (event.key === 'ArrowDown' && event.ctrlKey) {
        event.preventDefault();
        let novoValor = parseInt(slider.value) - 10;
        if (novoValor < 0) novoValor = 0;
        slider.value = novoValor;
        ajustarVolume(novoValor);
    }
});

// Inicializa o player quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    carregarYouTubeAPI();
});

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

// =====================================
// RANKING
// =====================================

async function atualizarTempoFirebase(tempoAdicional) {
    if (!usuarioAtual || tempoAdicional <= 0) return;
    try {
        const docRef = db.collection("ranking").doc(usuarioAtual.uid);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data.semana !== semanaAtual) {
                await docRef.update({ tempo: tempoAdicional, semana: semanaAtual, ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
                await docRef.update({ tempo: firebase.firestore.FieldValue.increment(tempoAdicional), ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
            }
        } else {
            await docRef.set({ uid: usuarioAtual.uid, nome: usuarioAtual.nome, tempo: tempoAdicional, semana: semanaAtual, ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp() });
        }
    } catch (error) {
        console.error("Erro ao atualizar ranking:", error);
    }
}

async function carregarRanking() {
    try {
        const snapshot = await db.collection("ranking").where("semana", "==", semanaAtual).get();
        rankingAtual = [];
        snapshot.forEach(doc => { rankingAtual.push({ id: doc.id, ...doc.data() }); });
        rankingAtual.sort((a, b) => b.tempo - a.tempo);
        atualizarRanking();
    } catch (error) {
        console.error("Erro ao carregar ranking:", error);
    }
}

// ✅ FUNÇÃO CORRIGIDA DO RANKING
function atualizarRanking() {
    const lista = document.getElementById("listaRanking");
    if (!lista) {
        console.error("❌ Elemento 'listaRanking' não encontrado!");
        return;
    }

    lista.innerHTML = "";

    if (rankingAtual.length === 0) {
        lista.innerHTML = `
            <div class="ranking-row">
                <div class="ranking-position">-</div>
                <div class="ranking-name">Nenhum registro esta semana</div>
                <div class="ranking-time">0min</div>
            </div>
        `;
        return;
    }

    rankingAtual.forEach((jogador, index) => {
        const linha = document.createElement("div");
        linha.className = "ranking-row";

        // 🔥 CORES PARA TOP 3
        if (index === 0) {
            linha.style.background = "linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, transparent 100%)";
            linha.style.borderLeft = "3px solid #FFD700";
        } else if (index === 1) {
            linha.style.background = "linear-gradient(135deg, rgba(192, 192, 192, 0.2) 0%, transparent 100%)";
            linha.style.borderLeft = "3px solid #C0C0C0";
        } else if (index === 2) {
            linha.style.background = "linear-gradient(135deg, rgba(205, 127, 50, 0.2) 0%, transparent 100%)";
            linha.style.borderLeft = "3px solid #CD7F32";
        }

        // 🔥 DESTACA O USUÁRIO ATUAL
        if (usuarioAtual && jogador.uid === usuarioAtual.uid) {
            linha.style.background = "linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(76, 175, 80, 0.05) 100%)";
            linha.style.borderLeft = "3px solid #4CAF50";
            linha.style.boxShadow = "0 0 30px rgba(76, 175, 80, 0.1)";
        }

        const nome = jogador.nome || jogador.uid || "Anônimo";

        linha.innerHTML = `
            <div class="ranking-position">${obterMedalha(index)}</div>
            <div class="ranking-name">${escaparHTML(nome)}</div>
            <div class="ranking-time">${formatarTempo(jogador.tempo || 0)}</div>
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

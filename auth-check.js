// auth-check.js - Verificação de autenticação em todas as páginas
document.addEventListener('DOMContentLoaded', function() {
    // Configuração Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyDIqJpw0EnBnkZWvXIbMQIxai394lsqAKA",
        authDomain: "barbearia-84d78.firebaseapp.com",
        projectId: "barbearia-84d78",
        storageBucket: "barbearia-84d78.firebasestorage.app",
        messagingSenderId: "42251761510",
        appId: "1:42251761510:web:03e036a25931a461c43aa7"
    };
    
    // Inicializar se não estiver
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();
    
    // Verificar autenticação
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // Se não estiver autenticado, redirecionar para login
            console.log('Usuário não autenticado, redirecionando...');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('Usuário autenticado:', user.email);
        
        // Se for página de agendamentos, configurar interface baseada no usuário
        if (window.location.pathname.includes('agendamentos.html')) {
            await setupAgendamentosForUser(user);
        }
    });
    
    async function setupAgendamentosForUser(user) {
        const db = firebase.firestore();
        const userEmail = user.email;
        
        // Verificar se é admin
        let isAdmin = false;
        let barberName = null;
        
        if (userEmail === 'admin@bolanos.com') {
            isAdmin = true;
            sessionStorage.setItem('userType', 'admin');
        } else {
            // Buscar barbeiro pelo email
            const barbersRef = db.collection('barbers');
            const snapshot = await barbersRef.where('email', '==', userEmail).get();
            
            if (!snapshot.empty) {
                const barberData = snapshot.docs[0].data();
                barberName = barberData.name;
                sessionStorage.setItem('userType', 'barber');
                sessionStorage.setItem('barberName', barberName);
            } else {
                // Se não encontrou, criar registro
                const nameFromEmail = userEmail.split('@')[0];
                barberName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
                
                await barbersRef.add({
                    email: userEmail,
                    name: barberName,
                    role: 'barber',
                    active: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                sessionStorage.setItem('userType', 'barber');
                sessionStorage.setItem('barberName', barberName);
            }
        }
        
        // Ajustar interface
        adjustInterfaceForUser(isAdmin, barberName, userEmail);
    }
    
    function adjustInterfaceForUser(isAdmin, barberName, userEmail) {
        console.log('Configurando interface:', {
            isAdmin,
            barberName,
            userEmail
        });
        
        // Atualizar nome do usuário no header
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            if (isAdmin) {
                userNameElement.textContent = `👑 ADMIN: ${userEmail}`;
            } else {
                userNameElement.textContent = `✂️ ${barberName}: ${userEmail}`;
            }
        }
        
        // Se for barbeiro (não admin), ajustar interface
        if (!isAdmin) {
            // 1. Ocultar botão de novo agendamento (barbeiro não pode criar)
            const newAppointmentBtn = document.getElementById('newAppointmentBtn');
            if (newAppointmentBtn) {
                newAppointmentBtn.style.display = 'none';
            }
            
            // 2. Ocultar filtro de barbeiro
            const barberFilterSection = document.getElementById('barberFilterSection');
            if (barberFilterSection) {
                barberFilterSection.style.display = 'none';
            }
            
            // 3. Adicionar mensagem informativa
            const calendarHeader = document.querySelector('.calendar-header h2');
            if (calendarHeader) {
                const infoBadge = document.createElement('span');
                infoBadge.style.cssText = `
                    background: #3498db;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    margin-left: 10px;
                    vertical-align: middle;
                `;
                infoBadge.innerHTML = `<i class="fas fa-user-tie"></i> Visualizando apenas seus agendamentos`;
                calendarHeader.appendChild(infoBadge);
            }
            
            // 4. Ocultar opções de admin na lista
            setTimeout(() => {
                document.querySelectorAll('.appointment-card').forEach(card => {
                    const actionsDiv = card.querySelector('.appointment-actions');
                    if (actionsDiv) {
                        // Mostrar apenas ações que o barbeiro pode fazer
                        const editBtn = actionsDiv.querySelector('button[title="Editar"]');
                        const confirmBtn = actionsDiv.querySelector('button[title="Confirmar Agendamento"]');
                        const completeBtn = actionsDiv.querySelector('button[title="Marcar como Concluído"]');
                        const cancelBtn = actionsDiv.querySelector('button[title="Cancelar"]');
                        
                        // Manter apenas essas ações
                        actionsDiv.innerHTML = '';
                        if (editBtn) actionsDiv.appendChild(editBtn);
                        if (confirmBtn) actionsDiv.appendChild(confirmBtn);
                        if (completeBtn) actionsDiv.appendChild(completeBtn);
                        if (cancelBtn) actionsDiv.appendChild(cancelBtn);
                    }
                });
            }, 1000);
        }
    }
});
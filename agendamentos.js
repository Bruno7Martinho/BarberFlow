// Sistema de gerenciamento de agendamentos - VERSÃO COMPLETA COM FILTRO POR BARBEIRO

// Variáveis globais
let appointmentsRef = null;
let clientsRef = null;
let servicesRef = null;
let currentAppointmentId = null;
let allAppointments = [];
let filteredAppointments = [];
let auth = null;
let db = null;
let currentUserBarber = null;
let isAdmin = false;

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM carregado, inicializando sistema de agendamentos...');
    initializeFirebaseAndAppointments();
});

// Inicializar Firebase primeiro, depois agendamentos
function initializeFirebaseAndAppointments() {
    console.log('Iniciando sistema de agendamentos...');

    // Verificar se Firebase está disponível
    if (typeof firebase === 'undefined') {
        console.log('Firebase não carregou ainda, aguardando...');
        setTimeout(initializeFirebaseAndAppointments, 500);
        return;
    }

    try {
        // Configuração do Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyDIqJpw0EnBnkZWvXIbMQIxai394lsqAKA",
            authDomain: "barbearia-84d78.firebaseapp.com",
            projectId: "barbearia-84d78",
            storageBucket: "barbearia-84d78.firebasestorage.app",
            messagingSenderId: "42251761510",
            appId: "1:42251761510:web:03e036a25931a461c43aa7"
        };

        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado');
        }

        // Obter referências
        auth = firebase.auth();
        db = firebase.firestore();
        appointmentsRef = db.collection("appointments");
        clientsRef = db.collection("clients");
        servicesRef = db.collection("services");

        console.log('Referências Firebase obtidas');

        // Verificar autenticação
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                console.log('Usuário não autenticado, redirecionando...');
                window.location.href = 'login.html';
                return;
            }

            console.log('Usuário autenticado:', user.email);
            
            // Determinar tipo de usuário
            await determineUserType(user);
            
            // Atualizar nome do usuário na interface
            updateUserNameDisplay(user);
            
            // Inicializar sistema de agendamentos
            initializeAppointments();
        });

    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        showAlert('error', 'Erro ao conectar com o banco de dados');
    }
}

// Determinar tipo de usuário (admin ou barbeiro)
async function determineUserType(user) {
    try {
        const userEmail = user.email;
        
        // Verificar se é admin pelo email
        if (userEmail === 'admin@bolanos.com') {
            isAdmin = true;
            currentUserBarber = null;
            console.log('Usuário identificado como ADMIN');
            return;
        }
        
        // Verificar na coleção de barbeiros
        const barbersRef = db.collection('barbers');
        const snapshot = await barbersRef.where('email', '==', userEmail).get();
        
        if (!snapshot.empty) {
            const barberData = snapshot.docs[0].data();
            currentUserBarber = barberData.name;
            isAdmin = false;
            console.log('Usuário identificado como BARBEIRO:', currentUserBarber);
        } else {
            // Se não encontrou, verificar pelo email
            if (userEmail === 'guilherme@admin.com') {
                currentUserBarber = 'Guilherme';
                isAdmin = false;
                
                // Criar registro do barbeiro
                await barbersRef.add({
                    email: userEmail,
                    name: 'Guilherme',
                    role: 'barber',
                    active: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Barbeiro Guilherme registrado no sistema');
            } 
            else if (userEmail === 'murilo@bolanos.com') {
                currentUserBarber = 'Murilo';
                isAdmin = false;
                
                // Criar registro do barbeiro
                await barbersRef.add({
                    email: userEmail,
                    name: 'Murilo',
                    role: 'barber',
                    active: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Barbeiro Murilo registrado no sistema');
            }
            else {
                // Usuário genérico - tratar como barbeiro
                currentUserBarber = 'Barbeiro';
                isAdmin = false;
                console.log('Usuário genérico identificado como BARBEIRO');
            }
        }
        
        // Salvar no sessionStorage para uso em outras páginas
        sessionStorage.setItem('isAdmin', isAdmin);
        sessionStorage.setItem('userBarber', currentUserBarber || '');
        
    } catch (error) {
        console.error('Erro ao determinar tipo de usuário:', error);
        isAdmin = false;
        currentUserBarber = null;
    }
}

// Atualizar exibição do nome do usuário
function updateUserNameDisplay(user) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        if (isAdmin) {
            userNameElement.textContent = `👑 ADMIN: ${user.email}`;
            userNameElement.style.color = '#e74c3c';
            userNameElement.style.fontWeight = 'bold';
        } else if (currentUserBarber) {
            userNameElement.textContent = `✂️ ${currentUserBarber}: ${user.email}`;
            userNameElement.style.color = '#3498db';
            userNameElement.style.fontWeight = 'bold';
        } else {
            userNameElement.textContent = user.email;
        }
    }
}

// ========== FUNÇÕES DO FORMULÁRIO ==========

async function saveAppointment(e) {
    console.log('💾 Iniciando salvamento de agendamento...');
    
    e.preventDefault();
    e.stopPropagation();

    // Encontrar o formulário que disparou o evento
    const form = e.target;
    
    if (!appointmentsRef) {
        showAlert('error', '❌ Erro: Banco de dados não disponível');
        return;
    }

    try {
        // Coletar dados do formulário CORRETAMENTE
        let rawDate = form.querySelector('#appointmentDate')?.value || '';
        let rawTime = form.querySelector('#appointmentTime')?.value || '';
        
        // Garantir que a data está no formato YYYY-MM-DD
        let formattedDate = '';
        if (rawDate) {
            const dateObj = new Date(rawDate + 'T00:00:00');
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
            
            console.log(`📅 Data formatada: "${rawDate}" -> "${formattedDate}"`);
        }

        // Garantir que o horário está no formato HH:MM
        let formattedTime = '';
        if (rawTime) {
            const timeParts = rawTime.split(':');
            if (timeParts.length >= 2) {
                formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            } else {
                formattedTime = rawTime;
            }
            console.log(`⏰ Hora formatada: "${rawTime}" -> "${formattedTime}"`);
        }

        const appointmentData = {
            clientId: form.querySelector('#clientSelect')?.value || '',
            serviceId: form.querySelector('#serviceSelect')?.value || '',
            barber: form.querySelector('#barberSelect')?.value || '',
            date: formattedDate,
            time: formattedTime,
            status: form.querySelector('#appointmentStatus')?.value || 'Agendado',
            notes: form.querySelector('#appointmentNotes')?.value || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('📋 Dados coletados para salvar:', appointmentData);

        // VALIDAÇÃO BÁSICA
        if (!appointmentData.clientId) {
            showAlert('error', '❌ Selecione um cliente');
            form.querySelector('#clientSelect')?.focus();
            return;
        }

        if (!appointmentData.serviceId) {
            showAlert('error', '❌ Selecione um serviço');
            form.querySelector('#serviceSelect')?.focus();
            return;
        }

        if (!appointmentData.barber) {
            showAlert('error', '❌ Selecione um barbeiro');
            form.querySelector('#barberSelect')?.focus();
            return;
        }

        if (!appointmentData.date) {
            showAlert('error', '❌ Informe a data');
            form.querySelector('#appointmentDate')?.focus();
            return;
        }

        if (!appointmentData.time) {
            showAlert('error', '❌ Informe o horário');
            form.querySelector('#appointmentTime')?.focus();
            return;
        }

        // VALIDAÇÃO DE DATA
        const dateObj = new Date(appointmentData.date + 'T00:00:00');
        if (isNaN(dateObj.getTime())) {
            showAlert('error', '❌ Data inválida');
            return;
        }

        // VALIDAÇÃO DE HORÁRIO
        const appointmentDate = new Date(appointmentData.date + 'T00:00:00');
        const dayOfWeek = appointmentDate.getDay();
        const appointmentHour = parseInt(appointmentData.time.split(':')[0]);

        console.log(`📅 Validação de data/hora:
            Data: ${appointmentData.date}
            Dia da semana: ${dayOfWeek} (${getDayName(dayOfWeek)})
            Hora: ${appointmentHour}`);

        // Verificar se é domingo (0)
        if (dayOfWeek === 0) {
            showAlert('error', '❌ A barbearia não funciona aos domingos');
            return;
        }

        // VALIDAÇÃO DE HORÁRIO COMERCIAL (8h às 20h)
        if (appointmentHour < 8 || appointmentHour > 20) {
            showAlert('error', '❌ Horário fora do funcionamento (8h às 20h)');
            return;
        }

        // Validar formato do horário
        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(appointmentData.time)) {
            showAlert('error', '❌ Horário inválido. Use formato HH:MM (24h)');
            return;
        }

        // Verificar conflito de horário
        const isConflict = await checkTimeConflict(appointmentData, currentAppointmentId);
        if (isConflict) {
            showAlert('error', '❌ Horário já ocupado para este barbeiro');
            return;
        }

        // Buscar nome do cliente para a mensagem
        let clientName = 'Cliente';
        let serviceName = 'Serviço';
        let servicePrice = 0;

        try {
            if (appointmentData.clientId) {
                const clientDoc = await clientsRef.doc(appointmentData.clientId).get();
                if (clientDoc.exists) {
                    clientName = clientDoc.data().name || 'Cliente';
                    console.log(`👤 Cliente encontrado: ${clientName}`);
                }
            }

            if (appointmentData.serviceId) {
                const serviceDoc = await servicesRef.doc(appointmentData.serviceId).get();
                if (serviceDoc.exists) {
                    const serviceData = serviceDoc.data();
                    serviceName = serviceData.name || 'Serviço';
                    servicePrice = serviceData.price || 0;
                    console.log(`✂️ Serviço encontrado: ${serviceName} - R$ ${servicePrice}`);
                }
            }
        } catch (fetchError) {
            console.warn('⚠️ Erro ao buscar detalhes:', fetchError);
        }

        // Adicionar dados de criação se for novo
        if (!currentAppointmentId && auth && auth.currentUser) {
            appointmentData.createdBy = auth.currentUser.email;
            appointmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            console.log('👤 Adicionando dados do criador:', auth.currentUser.email);
        }

        // Mostrar loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }

        console.log(`💾 Salvando no Firebase... (${currentAppointmentId ? 'Atualizar' : 'Criar novo'})`);
        
        let savedAppointment;
        
        if (currentAppointmentId) {
            // Atualizar agendamento existente
            console.log(`🔄 Atualizando agendamento ${currentAppointmentId}`);
            console.log('📤 Dados enviados ao Firebase:', appointmentData);
            
            await appointmentsRef.doc(currentAppointmentId).update(appointmentData);
            savedAppointment = { id: currentAppointmentId, ...appointmentData };
            console.log(`✅ Agendamento ${currentAppointmentId} atualizado`);
        } else {
            // Criar novo agendamento
            console.log('🆕 Criando novo agendamento');
            console.log('📤 Dados enviados ao Firebase:', appointmentData);
            
            const docRef = await appointmentsRef.add(appointmentData);
            savedAppointment = { id: docRef.id, ...appointmentData };
            console.log(`✅ Agendamento criado com ID: ${docRef.id}`);
        }

        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }

        // Mostrar mensagem de sucesso
        const statusEmoji = {
            'Agendado': '📅',
            'Confirmado': '✅',
            'Concluído': '🎉',
            'Cancelado': '🛑'
        }[appointmentData.status] || '📋';

        const successMessage = 
            `${statusEmoji} AGENDAMENTO SALVO COM SUCESSO!\n\n` +
            `👤 Cliente: ${clientName}\n` +
            `✂️ Serviço: ${serviceName}\n` +
            `💰 Valor: R$ ${servicePrice.toFixed(2).replace('.', ',')}\n` +
            `👨‍✈️ Barbeiro: ${appointmentData.barber}\n` +
            `📅 Data: ${formatDate(appointmentData.date)}\n` +
            `⏰ Horário: ${appointmentData.time}\n` +
            `📋 Status: ${appointmentData.status}`;
        
        console.log('📢 Mostrando mensagem de sucesso:', successMessage);
        showAlert('success', successMessage);

        // Fechar formulário
        console.log('🚪 Fechando formulário...');
        hideAppointmentForm();
        
        // Atualizar lista de agendamentos após um pequeno delay
        console.log('🔄 Recarregando lista de agendamentos...');
        setTimeout(() => {
            loadAppointments();
        }, 500);

        console.log('✅ Agendamento salvo com sucesso!', savedAppointment);

    } catch (error) {
        console.error('❌ Erro ao salvar agendamento:', error);
        console.error('❌ Stack trace:', error.stack);
        
        let errorMessage = `Erro ao salvar agendamento:\n${error.message}`;
        
        if (error.code === 'permission-denied') {
            errorMessage = '❌ Permissão negada. Verifique as regras do Firebase.';
        } else if (error.code === 'not-found') {
            errorMessage = '❌ Recurso não encontrado.';
        } else if (error.code === 'unavailable') {
            errorMessage = '❌ Serviço indisponível. Verifique sua conexão.';
        }
            
        showAlert('error', errorMessage);
        
        // Reabilitar botão em caso de erro
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Agendamento';
        }
    }
}

function showAppointmentForm() {
    console.log('📝 Abrindo formulário de agendamento...');
    
    // Verificar se barbeiro pode criar agendamento
    //if (!isAdmin && currentUserBarber) {
       // showAlert('warning', '⚠️ Barbeiros não podem criar novos agendamentos. Contate o administrador.');
      // return;
    //}
    
    // Remover overlay existente se houver
    hideAppointmentForm();
    
    const formContainer = document.getElementById('appointmentFormContainer');
    if (!formContainer) {
        console.error('❌ ERRO: Elemento appointmentFormContainer não encontrado!');
        createFormContainer();
        return;
    }
    
    currentAppointmentId = null;

    // Criar overlay
    const overlay = document.createElement('div');
    overlay.id = 'formOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    document.body.appendChild(overlay);
    
    // Criar wrapper
    const formWrapper = document.createElement('div');
    formWrapper.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100%;
        width: 100%;
        padding: 20px;
        overflow-y: auto;
    `;
    overlay.appendChild(formWrapper);
    
    // Clonar o formulário
    const formClone = formContainer.cloneNode(true);
    formClone.id = 'appointmentFormContainerClone';
    formClone.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        width: 100%;
        max-width: 600px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
        z-index: 1001;
    `;
    
    // Remover classe hidden do clone
    formClone.classList.remove('hidden');
    
    formWrapper.appendChild(formClone);
    
    // Definir valores padrão no clone
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const timeString = nextHour.getHours().toString().padStart(2, '0') + ':00';
    
    const cloneDateField = formClone.querySelector('#appointmentDate');
    const cloneTimeField = formClone.querySelector('#appointmentTime');
    const cloneStatusField = formClone.querySelector('#appointmentStatus');
    const cloneClientSelect = formClone.querySelector('#clientSelect');
    const cloneServiceSelect = formClone.querySelector('#serviceSelect');
    const cloneBarberSelect = formClone.querySelector('#barberSelect');
    
    if (cloneDateField) {
        cloneDateField.value = today;
        cloneDateField.min = today;
    }
    if (cloneTimeField) cloneTimeField.value = timeString;
    if (cloneStatusField) cloneStatusField.value = 'Agendado';
    if (cloneClientSelect) cloneClientSelect.value = '';
    if (cloneServiceSelect) cloneServiceSelect.value = '';
    if (cloneBarberSelect) cloneBarberSelect.value = '';
    
    // Configurar event listeners no clone
    const cloneForm = formClone.querySelector('#appointmentForm');
    const cloneCancelBtn = formClone.querySelector('#cancelFormBtn');
    
    if (cloneForm) {
        console.log('🔗 Adicionando listener de submit ao clone');
        cloneForm.addEventListener('submit', function(e) {
            console.log('🎯 Evento submit disparado no clone');
            saveAppointment(e);
        });
    } else {
        console.error('❌ Formulário não encontrado no clone');
    }
    
    if (cloneCancelBtn) {
        cloneCancelBtn.addEventListener('click', hideAppointmentForm);
    }
    
    // Adicionar botão de fechar
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        z-index: 1002;
    `;
    closeBtn.onclick = hideAppointmentForm;
    formClone.appendChild(closeBtn);
    
    // Carregar clientes e serviços
    loadClients();
    loadServices();
    
    // Focar no primeiro campo após um breve delay
    setTimeout(() => {
        const firstInput = formClone.querySelector('#clientSelect');
        if (firstInput) {
            firstInput.focus();
            console.log('🎯 Foco definido no select de cliente');
        }
    }, 200);
    
    // Fechar ao clicar fora do formulário
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            hideAppointmentForm();
        }
    });
    
    // Prevenir que o clique no formulário feche o overlay
    formClone.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    console.log('✅ Formulário de agendamento aberto');
}

function hideAppointmentForm() {
    console.log('Fechando formulário...');
    
    // Remover overlay se existir
    const overlay = document.getElementById('formOverlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Remover clone se existir
    const formClone = document.getElementById('appointmentFormContainerClone');
    if (formClone) {
        formClone.remove();
    }
    
    // Esconder formulário original (se ainda estiver visível)
    const formContainer = document.getElementById('appointmentFormContainer');
    if (formContainer) {
        formContainer.classList.add('hidden');
        formContainer.style.display = 'none';
    }
    
    currentAppointmentId = null;

    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.reset();
    }
    
    console.log('✅ Formulário fechado');
}

function createFormContainer() {
    console.log('🛠️ Criando formulário dinamicamente...');
    
    // Primeiro remover qualquer overlay/formulário existente
    const existingOverlay = document.getElementById('formOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'formOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    
    const formContainer = document.createElement('div');
    formContainer.id = 'appointmentFormContainer';
    formContainer.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
        z-index: 1001;
    `;
    
    formContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #2c3e50;">📅 Novo Agendamento</h2>
            <button id="closeFormBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
        </div>
        
        <form id="appointmentForm">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Cliente *</label>
                <select id="clientSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um cliente</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Serviço *</label>
                <select id="serviceSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um serviço</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Barbeiro *</label>
                <select id="barberSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um barbeiro</option>
                    <option value="Guilherme">Guilherme - Especialista em cortes de cabelo</option>
                </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Data *</label>
                    <input type="date" id="appointmentDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Horário *</label>
                    <input type="time" id="appointmentTime" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status</label>
                <select id="appointmentStatus" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="Agendado">Agendado</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Cancelado">Cancelado</option>
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Observações</label>
                <textarea id="appointmentNotes" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="cancelFormBtn" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Cancelar
                </button>
                <button type="submit" style="padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Salvar Agendamento
                </button>
            </div>
        </form>
    `;
    
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);
    
    // Adicionar event listeners
    document.getElementById('closeFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('cancelFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('appointmentForm').addEventListener('submit', saveAppointment);
    
    // Carregar dados nos selects
    setTimeout(() => {
        loadClients();
        loadServices();
        
        // Definir valores padrão
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const timeString = nextHour.getHours().toString().padStart(2, '0') + ':00';
        
        const dateField = document.getElementById('appointmentDate');
        const timeField = document.getElementById('appointmentTime');
        
        if (dateField) {
            dateField.value = today;
            dateField.min = today;
        }
        if (timeField) timeField.value = timeString;
    }, 100);
    
    console.log('✅ Formulário criado dinamicamente');
}

function refreshClientList() {
    // Limpar cache e forçar recarregamento
    loadClients();
    loadServices();
}

async function loadClients() {
    if (!clientsRef) {
        console.error('❌ clientsRef não está disponível!');
        return;
    }

    try {
        console.log('🔍 Buscando clientes no Firebase...');
        
        // Buscar todos os selects de cliente
        const clientSelects = document.querySelectorAll('#clientSelect, #appointmentFormContainerClone #clientSelect');
        console.log(`Encontrados ${clientSelects.length} select(s) de cliente`);
        
        if (clientSelects.length === 0) {
            console.warn('⚠️ Nenhum select de cliente encontrado no DOM');
            return;
        }

        // Buscar clientes do Firebase
        const snapshot = await clientsRef.orderBy('name').get();
        
        console.log(`📊 Firebase retornou ${snapshot.size} cliente(s)`);

        if (snapshot.empty) {
            console.log('ℹ️ Nenhum cliente cadastrado no banco de dados');
            
            // Atualizar todos os selects
            clientSelects.forEach(select => {
                // Manter apenas a primeira opção
                while (select.options.length > 1) {
                    select.remove(1);
                }
                // Adicionar mensagem
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Nenhum cliente cadastrado';
                option.disabled = true;
                select.appendChild(option);
            });
            return;
        }

        // Log dos clientes encontrados
        snapshot.forEach(doc => {
            console.log(`👤 Cliente: ${doc.id} - ${doc.data().name}`);
        });

        // Para cada select encontrado
        clientSelects.forEach((select, index) => {
            console.log(`🔄 Atualizando select ${index + 1}`);
            
            // Salvar o valor atual
            const currentValue = select.value;
            
            // Limpar todas as opções
            select.innerHTML = '';
            
            // Adicionar opção padrão
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecione um cliente';
            select.appendChild(defaultOption);
            
            // Adicionar os clientes
            snapshot.forEach(doc => {
                const client = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${client.name}${client.phone ? ` - ${client.phone}` : ''}`;
                option.title = client.phone ? `Telefone: ${client.phone}` : 'Sem telefone cadastrado';
                select.appendChild(option);
            });
            
            // Restaurar valor se existir
            if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                select.value = currentValue;
            }
        });

        console.log(`✅ ${snapshot.size} cliente(s) carregado(s) com sucesso`);
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        showAlert('error', `Erro ao carregar clientes: ${error.message}`);
    }
}

async function loadServices() {
    if (!servicesRef) return;

    try {
        // Buscar todos os selects de serviço (original e clones)
        const serviceSelects = document.querySelectorAll('#serviceSelect, #appointmentFormContainerClone #serviceSelect');
        if (serviceSelects.length === 0) return;

        // Buscar serviços do Firebase
        const snapshot = await servicesRef.orderBy('name').get();

        if (snapshot.empty) {
            console.log('Nenhum serviço cadastrado');
            
            // Atualizar todos os selects
            serviceSelects.forEach(select => {
                // Manter apenas a primeira opção
                while (select.options.length > 1) {
                    select.remove(1);
                }
            });
            return;
        }

        // Para cada select encontrado
        serviceSelects.forEach(select => {
            // Salvar a opção padrão
            const defaultOption = select.options[0];
            
            // Limpar todas as opções
            select.innerHTML = '';
            
            // Adicionar a opção padrão de volta
            select.appendChild(defaultOption);
            
            // Adicionar os serviços
            snapshot.forEach(doc => {
                const service = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${service.name} - R$ ${(service.price || 0).toFixed(2).replace('.', ',')}`;
                option.dataset.price = service.price || 0;
                option.title = service.description || service.name;
                select.appendChild(option);
            });
        });

        console.log(`${snapshot.size} serviço(s) carregado(s) em ${serviceSelects.length} select(s)`);
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// ========== FUNÇÕES PRINCIPAIS DO SISTEMA ==========

async function loadAppointments() {
    if (!appointmentsRef || !clientsRef || !servicesRef) {
        console.error('Referências não disponíveis');
        return;
    }

    try {
        console.log('Carregando agendamentos...');

        // Construir query baseada no tipo de usuário
        let query = appointmentsRef.orderBy('date', 'desc');
        
        // Se for barbeiro, filtrar apenas seus agendamentos
        if (!isAdmin && currentUserBarber) {
            console.log(`🔍 Filtrando agendamentos apenas para o barbeiro: ${currentUserBarber}`);
            query = appointmentsRef.where('barber', '==', currentUserBarber).orderBy('date', 'desc');
        }

        const snapshot = await query.get();

        allAppointments = [];
        filteredAppointments = [];

        if (snapshot.empty) {
            console.log('Nenhum agendamento encontrado');
            
            let message = 'Nenhum agendamento cadastrado.';
            if (!isAdmin && currentUserBarber) {
                message = `Nenhum agendamento encontrado para ${currentUserBarber}.`;
            }
            
            showAlert('info', message);
            updateUI([]);
            return;
        }

        console.log(`${snapshot.size} agendamento(s) encontrado(s)`);

        // Para cada agendamento, buscar detalhes
        const appointmentsData = [];

        for (const doc of snapshot.docs) {
            const appointment = doc.data();
            appointment.id = doc.id;

            // FORMATAR A DATA CORRETAMENTE (YYYY-MM-DD)
            if (appointment.date) {
                if (typeof appointment.date === 'string') {
                    const dateObj = new Date(appointment.date + 'T00:00:00');
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    appointment.date = `${year}-${month}-${day}`;
                    
                    console.log(`📅 Data formatada: ${doc.data().date} -> ${appointment.date}`);
                } else if (appointment.date.toDate) {
                    const dateObj = appointment.date.toDate();
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    appointment.date = `${year}-${month}-${day}`;
                }
            }

            // Buscar nome do cliente
            let clientName = 'Cliente não encontrado';
            let clientPhone = '';
            if (appointment.clientId) {
                try {
                    const clientDoc = await clientsRef.doc(appointment.clientId).get();
                    if (clientDoc.exists) {
                        const clientData = clientDoc.data();
                        clientName = clientData.name || 'Cliente sem nome';
                        clientPhone = clientData.phone || '';
                    }
                } catch (error) {
                    console.error('Erro ao buscar cliente:', error);
                }
            }

            // Buscar nome e preço do serviço
            let serviceName = 'Serviço não encontrado';
            let servicePrice = 0;
            if (appointment.serviceId) {
                try {
                    const serviceDoc = await servicesRef.doc(appointment.serviceId).get();
                    if (serviceDoc.exists) {
                        const serviceData = serviceDoc.data();
                        serviceName = serviceData.name || 'Serviço sem nome';
                        servicePrice = serviceData.price || 0;
                    }
                } catch (error) {
                    console.error('Erro ao buscar serviço:', error);
                }
            }

            appointmentsData.push({
                ...appointment,
                clientName,
                clientPhone,
                serviceName,
                servicePrice
            });
        }

        allAppointments = appointmentsData;
        filteredAppointments = [...appointmentsData];

        // DEBUG: Mostrar todos os agendamentos carregados
        console.log('📋 Agendamentos carregados:');
        appointmentsData.forEach((app, index) => {
            console.log(`${index + 1}. ${app.clientName} - ${app.date} ${app.time} (Barbeiro: ${app.barber})`);
        });

        // Atualizar UI
        updateUI(appointmentsData);

    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showAlert('error', 'Erro ao carregar agendamentos: ' + error.message);
    }
}

function updateUI(appointmentsData) {
    // Atualizar agenda visual
    if (document.getElementById('calendarWeekBody')) {
        renderCalendar();
    }

    // Atualizar lista de agendamentos
    const appointmentsList = document.getElementById('appointmentsList');
    if (appointmentsList) {
        renderAppointmentsList();
    }
}

async function checkTimeConflict(appointmentData, excludeId = null) {
    try {
        console.log(`🔍 Verificando conflito de horário:
            Barbeiro: ${appointmentData.barber}
            Data: ${appointmentData.date}
            Hora: ${appointmentData.time}
            Excluir ID: ${excludeId}`);
        
        // Verificar se já existe agendamento para o mesmo barbeiro, data e hora
        const querySnapshot = await appointmentsRef
            .where('barber', '==', appointmentData.barber)
            .where('date', '==', appointmentData.date)
            .where('time', '==', appointmentData.time)
            .get();

        console.log(`📊 Conflitos encontrados: ${querySnapshot.size}`);

        if (querySnapshot.empty) {
            console.log('✅ Nenhum conflito encontrado');
            return false;
        }

        // Verificar se é o mesmo agendamento (edição)
        for (const doc of querySnapshot.docs) {
            console.log(`   Agendamento existente: ${doc.id} - Status: ${doc.data().status}`);
            
            if (excludeId && doc.id === excludeId) {
                console.log(`   ⏭️  Ignorando mesmo agendamento (${excludeId})`);
                continue;
            }

            // Ignorar agendamentos cancelados
            const existing = doc.data();
            if (existing.status !== 'Cancelado') {
                console.log(`   ❌ Conflito encontrado! Agendamento ${doc.id} não está cancelado`);
                return true;
            } else {
                console.log(`   ⏭️  Ignorando agendamento cancelado`);
            }
        }

        console.log('✅ Nenhum conflito (apenas cancelados ou mesmo agendamento)');
        return false;
    } catch (error) {
        console.error('❌ Erro ao verificar conflito:', error);
        return false;
    }
}

// ========== FUNÇÕES DE GERENCIAMENTO DE AGENDAMENTOS ==========

async function editAppointment(id) {
    if (!appointmentsRef) {
        showAlert('error', '❌ Banco de dados não disponível');
        return;
    }

    try {
        const doc = await appointmentsRef.doc(id).get();

        if (!doc.exists) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }

        const appointment = doc.data();
        
        // Verificar permissões
        if (!isAdmin && currentUserBarber && appointment.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode editar seus próprios agendamentos');
            return;
        }
        
        currentAppointmentId = id;

        // Preencher formulário
        document.getElementById('clientSelect').value = appointment.clientId || '';
        document.getElementById('serviceSelect').value = appointment.serviceId || '';
        document.getElementById('barberSelect').value = appointment.barber || '';
        document.getElementById('appointmentDate').value = appointment.date || '';
        document.getElementById('appointmentTime').value = appointment.time || '';
        document.getElementById('appointmentStatus').value = appointment.status || 'Agendado';
        document.getElementById('appointmentNotes').value = appointment.notes || '';

        // Remover restrição de data mínima para edição
        const dateField = document.getElementById('appointmentDate');
        if (dateField) {
            dateField.removeAttribute('min');
        }

        // Mostrar formulário
        showAppointmentForm();
        
        // Preencher dados após um breve delay
        setTimeout(() => {
            document.getElementById('clientSelect').value = appointment.clientId || '';
            document.getElementById('serviceSelect').value = appointment.serviceId || '';
            document.getElementById('barberSelect').value = appointment.barber || '';
            document.getElementById('appointmentDate').value = appointment.date || '';
            document.getElementById('appointmentTime').value = appointment.time || '';
            document.getElementById('appointmentStatus').value = appointment.status || 'Agendado';
            document.getElementById('appointmentNotes').value = appointment.notes || '';
        }, 100);

        console.log('Editando agendamento:', id);

    } catch (error) {
        console.error('Erro ao carregar agendamento:', error);
        showAlert('error', '❌ Erro ao carregar agendamento: ' + error.message);
    }
}

async function deleteAppointment(id) {
    if (!confirm('🗑️ Tem certeza que deseja EXCLUIR este agendamento?\n\nEsta ação não pode ser desfeita e o agendamento será removido permanentemente.')) {
        return;
    }

    if (!appointmentsRef) {
        showAlert('error', '❌ Banco de dados não disponível');
        return;
    }

    try {
        // Buscar detalhes para verificar permissões
        const doc = await appointmentsRef.doc(id).get();
        if (!doc.exists) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }

        const appointment = doc.data();
        
        // Verificar permissões
        if (!isAdmin && currentUserBarber && appointment.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode excluir seus próprios agendamentos');
            return;
        }
        
        let clientName = 'Cliente';

        if (appointment.clientId) {
            const clientDoc = await clientsRef.doc(appointment.clientId).get();
            if (clientDoc.exists) {
                clientName = clientDoc.data().name;
            }
        }

        await appointmentsRef.doc(id).delete();

        showAlert('success',
            `🗑️ Agendamento EXCLUÍDO com sucesso!\n\n` +
            `👤 Cliente: ${clientName}\n` +
            `📅 Data: ${appointment.date}\n` +
            `⏰ Horário: ${appointment.time}`
        );

        loadAppointments();
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        showAlert('error', '❌ Erro ao excluir agendamento: ' + error.message);
    }
}

async function completeAppointment(id) {
    if (!confirm('✅ Marcar este agendamento como CONCLuÍDO?\n\nApós confirmar:\n• Status será alterado para "Concluído"\n• Aparecerá no relatório financeiro\n• Cliente pode ser notificado')) {
        return;
    }

    if (!appointmentsRef) {
        showAlert('error', '❌ Banco de dados não disponível');
        return;
    }

    try {
        // Buscar detalhes do agendamento para mostrar na mensagem
        const appointmentDoc = await appointmentsRef.doc(id).get();
        if (!appointmentDoc.exists) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }

        const appointmentData = appointmentDoc.data();
        
        // Verificar permissões
        if (!isAdmin && currentUserBarber && appointmentData.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode concluir seus próprios agendamentos');
            return;
        }
        
        const clientId = appointmentData.clientId;
        const serviceId = appointmentData.serviceId;

        let clientName = 'Cliente';
        let serviceName = 'Serviço';
        let servicePrice = 0;

        // Buscar nome do cliente
        if (clientId) {
            const clientDoc = await clientsRef.doc(clientId).get();
            if (clientDoc.exists) {
                clientName = clientDoc.data().name || 'Cliente';
            }
        }

        // Buscar nome e preço do serviço
        if (serviceId) {
            const serviceDoc = await servicesRef.doc(serviceId).get();
            if (serviceDoc.exists) {
                const serviceData = serviceDoc.data();
                serviceName = serviceData.name || 'Serviço';
                servicePrice = serviceData.price || 0;
            }
        }

        // Atualizar status para "Concluído"
        await appointmentsRef.doc(id).update({
            status: 'Concluído',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Fechar o modal se estiver aberto
        closeModal();

        // Mostrar mensagem de sucesso com detalhes
        showAlert('success',
            `🎉 AGENDAMENTO CONCLUÍDO!\n\n` +
            `✅ Status: CONCLUÍDO\n` +
            `👤 Cliente: ${clientName}\n` +
            `✂️ Serviço: ${serviceName}\n` +
            `💰 Valor: R$ ${servicePrice.toFixed(2).replace('.', ',')}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}\n\n` +
            `📊 O serviço agora aparece no relatório financeiro.`
        );

        // Atualizar dados
        setTimeout(() => {
            loadAppointments();
        }, 1000);

    } catch (error) {
        console.error('Erro ao concluir agendamento:', error);
        showAlert('error', '❌ Erro ao marcar como concluído: ' + error.message);
    }
}

async function cancelAppointment(id) {
    if (!confirm('🛑 CANCELAR este agendamento?\n\nApós confirmar:\n• Status será alterado para "Cancelado"\n• Não aparecerá no financeiro\n• Horário ficará disponível')) {
        return;
    }

    if (!appointmentsRef) {
        showAlert('error', '❌ Banco de dados não disponível');
        return;
    }

    try {
        // Buscar detalhes do agendamento
        const appointmentDoc = await appointmentsRef.doc(id).get();
        if (!appointmentDoc.exists) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }

        const appointmentData = appointmentDoc.data();
        
        // Verificar permissões
        if (!isAdmin && currentUserBarber && appointmentData.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode cancelar seus próprios agendamentos');
            return;
        }
        
        const clientId = appointmentData.clientId;

        let clientName = 'Cliente';
        if (clientId) {
            const clientDoc = await clientsRef.doc(clientId).get();
            if (clientDoc.exists) {
                clientName = clientDoc.data().name || 'Cliente';
            }
        }

        // Atualizar status para "Cancelado"
        await appointmentsRef.doc(id).update({
            status: 'Cancelado',
            canceledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Fechar o modal se estiver aberto
        closeModal();

        // Mostrar mensagem de sucesso
        showAlert('info',
            `🛑 AGENDAMENTO CANCELADO\n\n` +
            `🔴 Status: CANCELADO\n` +
            `👤 Cliente: ${clientName}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}\n\n` +
            `📋 O agendamento foi removido da agenda ativa.\n` +
            `⏱️ O horário está disponível para novos agendamentos.`
        );

        // Atualizar dados
        setTimeout(() => {
            loadAppointments();
        }, 1000);

    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        showAlert('error', '❌ Erro ao cancelar agendamento: ' + error.message);
    }
}

async function confirmAppointment(id) {
    if (!confirm('✅ CONFIRMAR este agendamento?\n\nApós confirmar:\n• Status será alterado para "Confirmado"\n• Cliente pode ser notificado\n• Agenda ficará bloqueada')) {
        return;
    }

    if (!appointmentsRef) {
        showAlert('error', '❌ Banco de dados não disponível');
        return;
    }

    try {
        const appointmentDoc = await appointmentsRef.doc(id).get();
        if (!appointmentDoc.exists) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }

        const appointmentData = appointmentDoc.data();
        
        // Verificar permissões
        if (!isAdmin && currentUserBarber && appointmentData.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode confirmar seus próprios agendamentos');
            return;
        }
        
        const clientId = appointmentData.clientId;

        let clientName = 'Cliente';
        if (clientId) {
            const clientDoc = await clientsRef.doc(clientId).get();
            if (clientDoc.exists) {
                clientName = clientDoc.data().name || 'Cliente';
            }
        }

        // Atualizar status para "Confirmado"
        await appointmentsRef.doc(id).update({
            status: 'Confirmado',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Fechar o modal se estiver aberto
        closeModal();

        // Mostrar mensagem de sucesso
        showAlert('success',
            `✅ AGENDAMENTO CONFIRMADO!\n\n` +
            `🟢 Status: CONFIRMADO\n` +
            `👤 Cliente: ${clientName}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}\n\n` +
            `📋 O cliente pode ser notificado sobre a confirmação.\n` +
            `🔒 O horário está confirmado na agenda.`
        );

        // Atualizar dados
        setTimeout(() => {
            loadAppointments();
        }, 1000);

    } catch (error) {
        console.error('Erro ao confirmar agendamento:', error);
        showAlert('error', '❌ Erro ao confirmar agendamento: ' + error.message);
    }
}

// ========== INICIALIZAR SISTEMA DE AGENDAMENTOS ==========

function initializeAppointments() {
    if (!appointmentsRef || !clientsRef || !servicesRef) {
        console.error('Referências Firebase não disponíveis');
        showAlert('error', 'Erro na conexão com o banco de dados');
        return;
    }

    console.log('Inicializando sistema de agendamentos...');
    console.log('Tipo de usuário:', isAdmin ? 'ADMIN' : `BARBEIRO (${currentUserBarber})`);

    // Ajustar interface baseada no tipo de usuário
    adjustInterfaceForUserType();

    // Verificar se elementos existem
    const newAppointmentBtn = document.getElementById('newAppointmentBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const appointmentForm = document.getElementById('appointmentForm');

    if (!newAppointmentBtn) {
        console.error('❌ Botão newAppointmentBtn não encontrado!');
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.textContent.includes('Novo') || btn.textContent.includes('Agendamento')) {
                console.log('Encontrado botão alternativo:', btn);
                btn.addEventListener('click', showAppointmentForm);
            }
        });
    } else {
        newAppointmentBtn.addEventListener('click', showAppointmentForm);
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideAppointmentForm);
    } else {
        console.log('Botão cancelFormBtn não encontrado');
    }

    if (appointmentForm) {
        appointmentForm.addEventListener('submit', saveAppointment);
    } else {
        console.error('Formulário appointmentForm não encontrado');
    }

    // Event Listeners para a agenda visual
    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');
    const todayBtn = document.getElementById('todayBtn');

    if (prevWeekBtn) prevWeekBtn.addEventListener('click', prevWeek);
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', nextWeek);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);

    // Event Listeners para filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            filterAppointments(filter);
        });
    });

    // Event Listeners para visualização
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            toggleView(view);
        });
    });

    // Inicializar filtro de barbeiro (apenas para admin)
    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter) {
        if (isAdmin) {
            barberFilter.addEventListener('change', function() {
                const selectedBarber = this.value;
                console.log('Filtro de barbeiro selecionado:', selectedBarber);
                filterByBarber(selectedBarber);
            });
        } else {
            // Ocultar filtro de barbeiro para barbeiros
            barberFilter.style.display = 'none';
            const barberFilterLabel = barberFilter.previousElementSibling;
            if (barberFilterLabel && barberFilterLabel.tagName === 'STRONG') {
                barberFilterLabel.style.display = 'none';
            }
        }
    }

    // Botão para limpar filtros
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Inicializar semana atual
    window.currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();

    // Carregar dados
    loadClients();
    loadServices();
    loadAppointments();

    // Verificar se veio de redirecionamento para novo agendamento
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        setTimeout(() => {
            showAppointmentForm();
        }, 1000);
    }

    // Ano atual no rodapé
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    console.log('✅ Sistema de agendamentos inicializado');
}

// Ajustar interface baseada no tipo de usuário
function adjustInterfaceForUserType() {
    console.log('Ajustando interface para:', isAdmin ? 'ADMIN' : `BARBEIRO ${currentUserBarber}`);
    
    // 1. Botão de novo agendamento
    const newAppointmentBtn = document.getElementById('newAppointmentBtn');
    if (newAppointmentBtn) {
        if (isAdmin) {
            newAppointmentBtn.style.display = 'block';
        } else {
            newAppointmentBtn.style.display = 'none';
            newAppointmentBtn.disabled = true;
            newAppointmentBtn.title = 'Barbeiros não podem criar novos agendamentos';
        }
    }
    
    // 2. Filtro de barbeiro (seção inteira)
    const barberFilterSection = document.querySelector('.section.mt-20');
    if (barberFilterSection) {
        if (isAdmin) {
            barberFilterSection.style.display = 'block';
        } else {
            barberFilterSection.style.display = 'none';
        }
    }
    
    // 3. Título da página
    const pageTitle = document.querySelector('.calendar-header h2');
    if (pageTitle) {
        if (!isAdmin && currentUserBarber) {
            const badge = document.createElement('span');
            badge.style.cssText = `
                background: #3498db;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                margin-left: 10px;
                vertical-align: middle;
            `;
            badge.innerHTML = `<i class="fas fa-user-tie"></i> ${currentUserBarber}`;
            pageTitle.appendChild(badge);
        }
    }
    
    // 4. Adicionar mensagem informativa
    if (!isAdmin && currentUserBarber) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            text-align: center;
            color: #495057;
        `;
        infoDiv.innerHTML = `
            <i class="fas fa-info-circle" style="color: #3498db; margin-right: 8px;"></i>
            <strong>Visualizando apenas seus agendamentos</strong> - Barbeiro: ${currentUserBarber}
        `;
        
        const calendarHeader = document.querySelector('.calendar-header');
        if (calendarHeader) {
            calendarHeader.parentNode.insertBefore(infoDiv, calendarHeader.nextSibling);
        }
    }
}

// ========== FUNÇÕES DA AGENDA VISUAL ==========

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    const dayOfWeek = d.getDay();
    
    let daysToMonday;
    if (dayOfWeek === 0) {
        daysToMonday = -6;
    } else if (dayOfWeek === 1) {
        daysToMonday = 0;
    } else {
        daysToMonday = 1 - dayOfWeek;
    }
    
    const monday = new Date(d);
    monday.setDate(d.getDate() + daysToMonday);
    
    return monday;
}

// Função auxiliar para nome dos dias
function getDayName(dayNumber) {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[dayNumber];
}

function updateWeekDisplay() {
    const weekStart = new Date(window.currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const options = { day: '2-digit', month: 'long' };
    const startStr = weekStart.toLocaleDateString('pt-BR', options);
    const endStr = weekEnd.toLocaleDateString('pt-BR', options);

    const weekRangeElement = document.getElementById('currentWeekRange');
    if (weekRangeElement) {
        weekRangeElement.textContent = `${startStr} - ${endStr}`;
    }

    updateCalendarDays();
    renderCalendar();
    renderAppointmentsList();
}

function updateCalendarDays() {
    const weekStart = new Date(window.currentWeekStart);
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const dayElements = document.querySelectorAll('.calendar-day');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dayElements.forEach((element, index) => {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + index);
        
        const dayName = days[index];
        const dayNumber = currentDate.getDate();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        element.innerHTML = `
            <div style="font-weight: bold; font-size: 0.9rem;">${dayName}</div>
            <div style="font-size: 1.4rem; font-weight: bold; margin: 5px 0;">${dayNumber}</div>
            <div style="font-size: 0.8rem; opacity: 0.7;">${month}/${year.toString().slice(2)}</div>
        `;

        // Destacar hoje
        element.classList.remove('today');
        if (currentDate.toDateString() === today.toDateString()) {
            element.classList.add('today');
        }

        // Destacar fim de semana
        element.classList.remove('weekend');
        if (index >= 5) {
            element.classList.add('weekend');
        }
    });
}

function prevWeek() {
    const newDate = new Date(window.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    window.currentWeekStart = newDate;
    console.log(`⬅️ Semana anterior: ${newDate.toLocaleDateString('pt-BR')}`);
    updateWeekDisplay();
}

function nextWeek() {
    const newDate = new Date(window.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    window.currentWeekStart = newDate;
    console.log(`➡️ Próxima semana: ${newDate.toLocaleDateString('pt-BR')}`);
    updateWeekDisplay();
}

function goToToday() {
    window.currentWeekStart = getWeekStart(new Date());
    console.log(`⏺️ Indo para hoje: ${window.currentWeekStart.toLocaleDateString('pt-BR')}`);
    updateWeekDisplay();
}

// RENDERIZAR CALENDÁRIO FUNCIONAL
function renderCalendar() {
    const calendarBody = document.getElementById('calendarWeekBody');
    if (!calendarBody) return;

    // Limpar calendário
    calendarBody.innerHTML = '';

    // Usar os agendamentos filtrados
    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;

    // Obter a semana atual
    const weekStart = new Date(window.currentWeekStart);

    // Gerar horários das 8h às 20h (30 minutos cada)
    for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-time-slot';

            // Coluna de hora
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            timeSlot.appendChild(timeLabel);

            // Células para cada dia da semana (0-6 = Segunda a Domingo)
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                cell.dataset.day = dayIndex;
                cell.dataset.hour = hour;
                cell.dataset.minute = minute;

                // Calcular data deste dia
                const cellDate = new Date(weekStart);
                cellDate.setDate(weekStart.getDate() + dayIndex);
                
                // Formatar data como YYYY-MM-DD para comparação
                const year = cellDate.getFullYear();
                const month = String(cellDate.getMonth() + 1).padStart(2, '0');
                const day = String(cellDate.getDate()).padStart(2, '0');
                const dateString = `${year}-${month}-${day}`;

                // Destacar hoje
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (cellDate.toDateString() === today.toDateString()) {
                    cell.classList.add('today');
                }

                // Destacar fim de semana
                if (dayIndex >= 5) {
                    cell.classList.add('weekend');
                }

                // Domingo fechado (índice 6)
                if (dayIndex === 6) {
                    cell.classList.add('closed');
                    cell.innerHTML = '<div class="closed-label">Fechado</div>';
                    timeSlot.appendChild(cell);
                    continue;
                }

                // Buscar agendamentos para este horário e dia
                const appointmentsForSlot = appointmentsToShow.filter(app => {
                    if (!app.date || !app.time) {
                        return false;
                    }

                    // Formatar a data do agendamento para comparação
                    let appDateStr = app.date;
                    
                    if (app.date.includes('/')) {
                        const parts = app.date.split('/');
                        appDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } else if (app.date.includes('T')) {
                        appDateStr = app.date.split('T')[0];
                    }
                    
                    if (appDateStr !== dateString) {
                        return false;
                    }

                    // Verificar horário
                    let appHour, appMinute;
                    
                    if (app.time.includes(':')) {
                        const timeParts = app.time.split(':');
                        appHour = parseInt(timeParts[0]);
                        appMinute = parseInt(timeParts[1] || '0');
                    } else {
                        appHour = parseInt(app.time);
                        appMinute = 0;
                    }

                    if (isNaN(appHour) || isNaN(appMinute)) {
                        return false;
                    }

                    const roundedMinute = Math.floor(appMinute / 30) * 30;

                    return appHour === hour && roundedMinute === minute;
                });

                // Adicionar eventos à célula
                appointmentsForSlot.forEach(appointment => {
                    const event = createCalendarEvent(appointment);
                    cell.appendChild(event);
                });

                timeSlot.appendChild(cell);
            }

            calendarBody.appendChild(timeSlot);
        }
    }
    
    console.log('✅ Calendário renderizado');
}

function createCalendarEvent(appointment) {
    const event = document.createElement('div');
    event.className = `calendar-event ${getStatusClass(appointment.status)}`;
    event.onclick = (e) => {
        e.stopPropagation();
        showAppointmentDetails(appointment);
    };

    // Formatar hora
    let displayTime = appointment.time;
    if (displayTime && displayTime.length > 5) {
        displayTime = displayTime.substring(0, 5);
    }

    // Limitar texto
    const clientName = appointment.clientName.length > 8
        ? appointment.clientName.substring(0, 8) + '...'
        : appointment.clientName;

    event.innerHTML = `
        <div class="event-time">${displayTime || ''}</div>
        <div class="event-title">${escapeHtml(clientName)}</div>
        <div class="event-barber">${appointment.barber ? appointment.barber.substring(0, 3) : ''}</div>
    `;

    // Tooltip
    event.title = `
Cliente: ${appointment.clientName}
Serviço: ${appointment.serviceName}
Barbeiro: ${appointment.barber || 'Não especificado'}
Horário: ${appointment.time}
Status: ${appointment.status}
${appointment.notes ? `Observações: ${appointment.notes}` : ''}
    `.trim();

    return event;
}

// RENDERIZAR LISTA DE AGENDAMENTOS
function renderAppointmentsList() {
    const appointmentsList = document.getElementById('appointmentsList');
    if (!appointmentsList) return;

    // Usar os agendamentos filtrados
    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;

    if (appointmentsToShow.length === 0) {
        appointmentsList.innerHTML = '<div class="text-center" style="padding: 20px; color: #666;">Nenhum agendamento encontrado</div>';
        return;
    }

    // Filtrar para a semana atual
    const weekStart = new Date(window.currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekAppointments = appointmentsToShow.filter(app => {
        if (!app.date) return false;
        const appDate = new Date(app.date + 'T00:00:00');
        return appDate >= weekStart && appDate < weekEnd;
    });

    if (weekAppointments.length === 0) {
        appointmentsList.innerHTML = '<div class="text-center" style="padding: 20px; color: #666;">Nenhum agendamento para esta semana</div>';
        return;
    }

    // Agrupar por data
    const appointmentsByDate = {};
    weekAppointments.forEach(app => {
        if (!appointmentsByDate[app.date]) {
            appointmentsByDate[app.date] = [];
        }
        appointmentsByDate[app.date].push(app);
    });

    // Ordenar datas
    const sortedDates = Object.keys(appointmentsByDate).sort();

    appointmentsList.innerHTML = '';

    // Renderizar cada data
    sortedDates.forEach(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('pt-BR');

        // Cabeçalho do dia
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.innerHTML = `
            <h4>
                <i class="fas fa-calendar-day"></i>
                ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} - ${formattedDate}
                ${date.getDay() === 6 ? '<span class="saturday-badge">SÁBADO</span>' : ''}
            </h4>
            <span class="day-count">${appointmentsByDate[dateStr].length} agendamento(s)</span>
        `;
        appointmentsList.appendChild(dayHeader);

        // Agendamentos do dia
        const dayAppointments = appointmentsByDate[dateStr].sort((a, b) => {
            return (a.time || '').localeCompare(b.time || '');
        });

        dayAppointments.forEach(appointment => {
            const card = document.createElement('div');
            card.className = `appointment-card ${getStatusClass(appointment.status)}`;
            card.onclick = () => showAppointmentDetails(appointment);

            let displayTime = appointment.time;
            if (displayTime && displayTime.length > 5) {
                displayTime = displayTime.substring(0, 5);
            }

            // Botões de ação baseados no status e permissões
            let actionButtons = '';
            const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);
            
            if (appointment.status === 'Agendado' && canManage) {
                actionButtons = `
                    <button class="btn-action btn-success" onclick="event.stopPropagation(); confirmAppointment('${appointment.id}')" title="Confirmar Agendamento">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn-action btn-primary" onclick="event.stopPropagation(); completeAppointment('${appointment.id}')" title="Marcar como Concluído">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-action btn-warning" onclick="event.stopPropagation(); cancelAppointment('${appointment.id}')" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            } else if (appointment.status === 'Confirmado' && canManage) {
                actionButtons = `
                    <button class="btn-action btn-primary" onclick="event.stopPropagation(); completeAppointment('${appointment.id}')" title="Marcar como Concluído">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-action btn-warning" onclick="event.stopPropagation(); cancelAppointment('${appointment.id}')" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            } else if (appointment.status === 'Concluído') {
                actionButtons = `
                    <span class="status-badge completed" style="margin-right: 10px;">
                        <i class="fas fa-check"></i> Concluído
                    </span>
                `;
            } else if (appointment.status === 'Cancelado') {
                actionButtons = `
                    <span class="status-badge canceled" style="margin-right: 10px;">
                        <i class="fas fa-times"></i> Cancelado
                    </span>
                `;
            }

            card.innerHTML = `
                <div class="appointment-info">
                    <div class="appointment-time">
                        <i class="fas fa-clock"></i>
                        <strong>${displayTime || ''}</strong>
                    </div>
                    <h4>${escapeHtml(appointment.clientName)}</h4>
                    <div class="appointment-meta">
                        <span><i class="fas fa-user-tie"></i> ${appointment.barber || 'Sem barbeiro'}</span>
                        <span><i class="fas fa-scissors"></i> ${appointment.serviceName}</span>
                        <span class="status-badge ${getStatusClass(appointment.status)}">${appointment.status}</span>
                    </div>
                    ${appointment.notes ? `<div class="appointment-notes"><i class="fas fa-sticky-note"></i> ${appointment.notes}</div>` : ''}
                </div>
                <div class="appointment-actions">
                    ${canManage ? `
                        <button class="btn-action" onclick="event.stopPropagation(); editAppointment('${appointment.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${actionButtons}
                        <button class="btn-action btn-danger" onclick="event.stopPropagation(); deleteAppointment('${appointment.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <span style="color: #666; font-size: 0.9rem;">
                            <i class="fas fa-lock"></i> Apenas visualização
                        </span>
                    `}
                </div>
            `;

            appointmentsList.appendChild(card);
        });
    });
}

// ========== FUNÇÕES ADICIONAIS ==========

function showAppointmentDetails(appointment) {
    const modal = document.getElementById('appointmentModal');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    // Verificar permissões
    const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);

    // Botões baseados no status e permissões
    let actionButtons = '';
    if (canManage) {
        if (appointment.status === 'Agendado') {
            actionButtons = `
                <button class="btn btn-success" onclick="confirmAppointment('${appointment.id}')">
                    <i class="fas fa-check-circle"></i> Confirmar
                </button>
                <button class="btn btn-primary" onclick="completeAppointment('${appointment.id}')">
                    <i class="fas fa-check"></i> Concluir
                </button>
                <button class="btn btn-warning" onclick="cancelAppointment('${appointment.id}')">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            `;
        } else if (appointment.status === 'Confirmado') {
            actionButtons = `
                <button class="btn btn-primary" onclick="completeAppointment('${appointment.id}')">
                    <i class="fas fa-check"></i> Concluir
                </button>
                <button class="btn btn-warning" onclick="cancelAppointment('${appointment.id}')">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            `;
        }
    }

    modalBody.innerHTML = `
        <div class="appointment-details">
            <div class="detail-row">
                <strong><i class="fas fa-user"></i> Cliente:</strong> 
                <span>${appointment.clientName}</span>
                ${appointment.clientPhone ? `<br><small><i class="fas fa-phone"></i> ${appointment.clientPhone}</small>` : ''}
            </div>
            <div class="detail-row">
                <strong><i class="fas fa-scissors"></i> Serviço:</strong> 
                <span>${appointment.serviceName} - R$ ${appointment.servicePrice.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="detail-row">
                <strong><i class="fas fa-user-tie"></i> Barbeiro:</strong> 
                <span>${appointment.barber || 'Não especificado'}</span>
            </div>
            <div class="detail-row">
                <strong><i class="fas fa-calendar"></i> Data:</strong> 
                <span>${formatDate(appointment.date)} às ${appointment.time}</span>
            </div>
            <div class="detail-row">
                <strong><i class="fas fa-info-circle"></i> Status:</strong> 
                <span class="status-badge ${getStatusClass(appointment.status)}">${appointment.status}</span>
            </div>
            ${appointment.notes ? `<div class="detail-row">
                <strong><i class="fas fa-sticky-note"></i> Observações:</strong> 
                <span>${appointment.notes}</span>
            </div>` : ''}
        </div>
        <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
            ${canManage ? `
                <button class="btn btn-primary" onclick="editAppointment('${appointment.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                ${actionButtons}
                <button class="btn btn-danger" onclick="deleteAppointment('${appointment.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            ` : `
                <span style="color: #666; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    <i class="fas fa-lock"></i> Apenas visualização
                </span>
            `}
        </div>
    `;

    window.selectedAppointmentId = appointment.id;
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    window.selectedAppointmentId = null;
}

function filterAppointments(filter) {
    if (allAppointments.length === 0) return;

    let filtered = [...allAppointments];
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    switch (filter) {
        case 'all':
            filtered = [...allAppointments];
            break;
        case 'today':
            filtered = filtered.filter(app => app.date === today);
            break;
        case 'week':
            filtered = filtered.filter(app => {
                if (!app.date) return false;
                const appDate = new Date(app.date + 'T00:00:00');
                return appDate >= weekStart && appDate < weekEnd;
            });
            break;
        case 'confirmed':
            filtered = filtered.filter(app => app.status === 'Confirmado');
            break;
        case 'pending':
            filtered = filtered.filter(app => app.status === 'Agendado');
            break;
        case 'completed':
            filtered = filtered.filter(app => app.status === 'Concluído');
            break;
        case 'canceled':
            filtered = filtered.filter(app => app.status === 'Cancelado');
            break;
    }

    // Atualizar os agendamentos filtrados
    filteredAppointments = filtered;

    // Resetar filtro de barbeiro quando usar outros filtros
    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter && isAdmin) {
        barberFilter.value = '';
    }

    // Atualizar visualização
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }

    // Mostrar mensagem
    if (filter !== 'all') {
        showAlert('info', `Mostrando ${filtered.length} agendamento(s) filtrado(s)`);
    }
}

function filterByBarber(barberName) {
    if (allAppointments.length === 0) {
        showAlert('info', 'Nenhum agendamento para filtrar');
        return;
    }

    console.log('Filtrando por barbeiro:', barberName);

    let filtered = [...allAppointments];

    if (barberName && barberName !== '') {
        filtered = filtered.filter(app => app.barber === barberName);
    }

    // Atualizar os agendamentos filtrados
    filteredAppointments = filtered;

    // Resetar outros filtros de botão quando filtrar por barbeiro
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');

    // Atualizar visualização
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }

    // Mostrar mensagem de quantos resultados
    if (barberName && barberName !== '') {
        showAlert('info', `Mostrando ${filtered.length} agendamento(s) para o barbeiro ${barberName}`);
    } else {
        showAlert('info', `Mostrando todos os ${filtered.length} agendamento(s)`);
        filteredAppointments = [];
    }
}

function toggleView(view) {
    const calendarContainer = document.querySelector('.calendar-container');
    const appointmentsSection = document.querySelector('.appointments-list')?.parentElement;

    if (view === 'calendar' && calendarContainer) {
        calendarContainer.style.display = 'block';
        if (appointmentsSection) {
            appointmentsSection.style.display = 'none';
        }
        renderCalendar();
    } else if (appointmentsSection) {
        if (calendarContainer) {
            calendarContainer.style.display = 'none';
        }
        appointmentsSection.style.display = 'block';
        renderAppointmentsList();
    }
}

function clearAllFilters() {
    console.log('Limpando todos os filtros...');
    
    // Resetar filtro de barbeiro (apenas para admin)
    if (isAdmin) {
        const barberFilter = document.getElementById('barberFilter');
        if (barberFilter) {
            barberFilter.value = '';
        }
    }
    
    // Resetar filtros de botão
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    
    // Resetar agendamentos filtrados
    filteredAppointments = [];
    
    // Atualizar visualização
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }
    
    showAlert('info', 'Todos os filtros foram limpos.');
}

// ========== FUNÇÕES UTILITÁRIAS ==========

function formatDate(dateString) {
    if (!dateString) return 'Data inválida';
    
    try {
        const date = new Date(dateString + 'T00:00:00');
        
        if (isNaN(date.getTime())) {
            return 'Data inválida';
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Data inválida';
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'Confirmado':
            return 'confirmed';
        case 'Concluído':
            return 'completed';
        case 'Cancelado':
            return 'canceled';
        default:
            return 'pending';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(type, message) {
    console.log(`🔔 Mostrando alerta [${type}]:`, message);
    
    // Remover alertas antigos
    const existingAlerts = document.querySelectorAll('#alertMessage');
    existingAlerts.forEach(alert => alert.remove());
    
    // Criar novo alerta
    const alertDiv = document.createElement('div');
    alertDiv.id = 'alertMessage';
    
    // Converter quebras de linha para HTML
    const formattedMessage = message.replace(/\n/g, '<br>');
    
    alertDiv.innerHTML = `
        <div style="display: flex; align-items: center; padding: 10px;">
            <div style="margin-right: 10px; font-size: 1.5em;">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div style="flex: 1;">
                ${formattedMessage}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; color: #666; cursor: pointer; font-size: 1.2em; margin-left: 10px;">
                ×
            </button>
        </div>
    `;
    
    // Estilizar
    const styles = {
        success: {
            bg: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderLeft: '5px solid #28a745'
        },
        error: {
            bg: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderLeft: '5px solid #dc3545'
        },
        info: {
            bg: '#d1ecf1',
            color: '#0c5460',
            border: '1px solid #bee5eb',
            borderLeft: '5px solid #17a2b8'
        },
        warning: {
            bg: '#fff3cd',
            color: '#856404',
            border: '1px solid #ffeaa7',
            borderLeft: '5px solid #ffc107'
        }
    };
    
    const style = styles[type] || styles.info;
    
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-width: 90%;
        border-radius: 8px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        background-color: ${style.bg};
        color: ${style.color};
        border: ${style.border};
        border-left: ${style.borderLeft};
    `;
    
    // Adicionar ao body
    document.body.appendChild(alertDiv);
    
    // Adicionar animação
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(styleSheet);
    
    // Ocultar após 8 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.style.animation = 'fadeOut 0.5s ease forwards';
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 500);
        }
    }, 8000);
    
    console.log('✅ Alerta criado e adicionado ao DOM');
}

function logout() {
    if (auth) {
        auth.signOut().then(() => {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Erro no logout:', error);
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    } else {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// ========== EXPORTAR FUNÇÕES PARA USO GLOBAL ==========
window.saveAppointment = saveAppointment;
window.showAppointmentForm = showAppointmentForm;
window.hideAppointmentForm = hideAppointmentForm;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.completeAppointment = completeAppointment;
window.cancelAppointment = cancelAppointment;
window.confirmAppointment = confirmAppointment;
window.logout = logout;
window.closeModal = closeModal;
window.filterByBarber = filterByBarber;
window.clearAllFilters = clearAllFilters;

console.log('✅ Módulo de agendamentos carregado com sucesso!');
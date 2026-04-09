// Sistema de gerenciamento de agendamentos - VERSÃO SEM RESTRIÇÕES DE DATA/HORA

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

    if (typeof firebase === 'undefined') {
        console.log('Firebase não carregou ainda, aguardando...');
        setTimeout(initializeFirebaseAndAppointments, 500);
        return;
    }

    try {
        const firebaseConfig = {
            apiKey: "AIzaSyDIqJpw0EnBnkZWvXIbMQIxai394lsqAKA",
            authDomain: "barbearia-84d78.firebaseapp.com",
            projectId: "barbearia-84d78",
            storageBucket: "barbearia-84d78.firebasestorage.app",
            messagingSenderId: "42251761510",
            appId: "1:42251761510:web:03e036a25931a461c43aa7"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado');
        }

        auth = firebase.auth();
        db = firebase.firestore();
        appointmentsRef = db.collection("appointments");
        clientsRef = db.collection("clients");
        servicesRef = db.collection("services");

        console.log('Referências Firebase obtidas');

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                console.log('Usuário não autenticado, redirecionando...');
                window.location.href = 'login.html';
                return;
            }

            console.log('Usuário autenticado:', user.email);
            
            await determineUserType(user);
            updateUserNameDisplay(user);
            initializeAppointments();
        });

    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        showAlert('error', 'Erro ao conectar com o banco de dados');
    }
}

async function determineUserType(user) {
    try {
        const userEmail = user.email;
        
        if (userEmail === 'admin@bolanos.com') {
            isAdmin = true;
            currentUserBarber = null;
            console.log('Usuário identificado como ADMIN');
            return;
        }
        
        const barbersRef = db.collection('barbers');
        const snapshot = await barbersRef.where('email', '==', userEmail).get();
        
        if (!snapshot.empty) {
            const barberData = snapshot.docs[0].data();
            currentUserBarber = barberData.name;
            isAdmin = false;
            console.log('Usuário identificado como BARBEIRO:', currentUserBarber);
        } else {
            if (userEmail === 'guilherme@admin.com') {
                currentUserBarber = 'Guilherme';
                isAdmin = false;
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
                currentUserBarber = 'Barbeiro';
                isAdmin = false;
                console.log('Usuário genérico identificado como BARBEIRO');
            }
        }
        
        sessionStorage.setItem('isAdmin', isAdmin);
        sessionStorage.setItem('userBarber', currentUserBarber || '');
        
    } catch (error) {
        console.error('Erro ao determinar tipo de usuário:', error);
        isAdmin = false;
        currentUserBarber = null;
    }
}

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

    const form = e.target;
    
    if (!appointmentsRef) {
        showAlert('error', '❌ Erro: Banco de dados não disponível');
        return;
    }

    try {
        let rawDate = form.querySelector('#appointmentDate')?.value || '';
        let rawTime = form.querySelector('#appointmentTime')?.value || '';
        
        let formattedDate = '';
        if (rawDate) {
            const dateObj = new Date(rawDate + 'T00:00:00');
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
            console.log(`📅 Data formatada: "${rawDate}" -> "${formattedDate}"`);
        }

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

        const dateObj = new Date(appointmentData.date + 'T00:00:00');
        if (isNaN(dateObj.getTime())) {
            showAlert('error', '❌ Data inválida');
            return;
        }

        // ===== TODAS AS VALIDAÇÕES DE DATA/HORA FORAM REMOVIDAS =====
        // Pode agendar qualquer data (passada, presente ou futura)
        // Pode agendar qualquer horário (até mesmo já passado)
        // Pode agendar aos domingos
        // Pode agendar fora do horário comercial

        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(appointmentData.time)) {
            showAlert('error', '❌ Horário inválido. Use formato HH:MM (24h)');
            return;
        }

        const isConflict = await checkTimeConflict(appointmentData, currentAppointmentId);
        if (isConflict) {
            showAlert('error', '❌ Horário já ocupado para este barbeiro');
            return;
        }

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

        if (!currentAppointmentId && auth && auth.currentUser) {
            appointmentData.createdBy = auth.currentUser.email;
            appointmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            console.log('👤 Adicionando dados do criador:', auth.currentUser.email);
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }

        console.log(`💾 Salvando no Firebase... (${currentAppointmentId ? 'Atualizar' : 'Criar novo'})`);
        
        let savedAppointment;
        
        if (currentAppointmentId) {
            console.log(`🔄 Atualizando agendamento ${currentAppointmentId}`);
            await appointmentsRef.doc(currentAppointmentId).update(appointmentData);
            savedAppointment = { id: currentAppointmentId, ...appointmentData };
            console.log(`✅ Agendamento ${currentAppointmentId} atualizado`);
        } else {
            console.log('🆕 Criando novo agendamento');
            const docRef = await appointmentsRef.add(appointmentData);
            savedAppointment = { id: docRef.id, ...appointmentData };
            console.log(`✅ Agendamento criado com ID: ${docRef.id}`);
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }

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
        
        showAlert('success', successMessage);

        hideAppointmentForm();
        
        setTimeout(() => {
            loadAppointments();
        }, 500);

        console.log('✅ Agendamento salvo com sucesso!', savedAppointment);

    } catch (error) {
        console.error('❌ Erro ao salvar agendamento:', error);
        
        let errorMessage = `Erro ao salvar agendamento:\n${error.message}`;
        
        if (error.code === 'permission-denied') {
            errorMessage = '❌ Permissão negada. Verifique as regras do Firebase.';
        } else if (error.code === 'not-found') {
            errorMessage = '❌ Recurso não encontrado.';
        } else if (error.code === 'unavailable') {
            errorMessage = '❌ Serviço indisponível. Verifique sua conexão.';
        }
            
        showAlert('error', errorMessage);
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Agendamento';
        }
    }
}

function showAppointmentForm() {
    console.log('📝 Abrindo formulário de agendamento...');
    
    hideAppointmentForm();
    
    const formContainer = document.getElementById('appointmentFormContainer');
    if (!formContainer) {
        console.error('❌ ERRO: Elemento appointmentFormContainer não encontrado!');
        createFormContainer();
        return;
    }
    
    currentAppointmentId = null;

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
    
    formClone.classList.remove('hidden');
    formWrapper.appendChild(formClone);
    
    // ===== REMOVIDA A RESTRIÇÃO DE DATA MÍNIMA =====
    // Agora pode selecionar QUALQUER data (passada, presente ou futura)
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
        // REMOVIDO: cloneDateField.min = today;  // Não bloqueia mais datas passadas
        cloneDateField.removeAttribute('min'); // Remove qualquer restrição
    }
    if (cloneTimeField) cloneTimeField.value = timeString;
    if (cloneStatusField) cloneStatusField.value = 'Agendado';
    if (cloneClientSelect) cloneClientSelect.value = '';
    if (cloneServiceSelect) cloneServiceSelect.value = '';
    if (cloneBarberSelect) cloneBarberSelect.value = '';
    
    const cloneForm = formClone.querySelector('#appointmentForm');
    const cloneCancelBtn = formClone.querySelector('#cancelFormBtn');
    
    if (cloneForm) {
        cloneForm.addEventListener('submit', function(e) {
            saveAppointment(e);
        });
    }
    
    if (cloneCancelBtn) {
        cloneCancelBtn.addEventListener('click', hideAppointmentForm);
    }
    
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
    
    loadClients();
    loadServices();
    
    setTimeout(() => {
        const firstInput = formClone.querySelector('#clientSelect');
        if (firstInput) {
            firstInput.focus();
        }
    }, 200);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            hideAppointmentForm();
        }
    });
    
    formClone.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    console.log('✅ Formulário de agendamento aberto - SEM RESTRIÇÕES de data/hora');
}

function hideAppointmentForm() {
    console.log('Fechando formulário...');
    
    const overlay = document.getElementById('formOverlay');
    if (overlay) {
        overlay.remove();
    }
    
    const formClone = document.getElementById('appointmentFormContainerClone');
    if (formClone) {
        formClone.remove();
    }
    
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
                    <option value="Murilo">Murilo - Especialista em barba</option>
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
    
    document.getElementById('closeFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('cancelFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('appointmentForm').addEventListener('submit', saveAppointment);
    
    setTimeout(() => {
        loadClients();
        loadServices();
        
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const timeString = nextHour.getHours().toString().padStart(2, '0') + ':00';
        
        const dateField = document.getElementById('appointmentDate');
        const timeField = document.getElementById('appointmentTime');
        
        if (dateField) {
            dateField.value = today;
            // REMOVIDO: dateField.min = today;  // Não bloqueia mais datas passadas
            dateField.removeAttribute('min');
        }
        if (timeField) timeField.value = timeString;
    }, 100);
    
    console.log('✅ Formulário criado dinamicamente - SEM RESTRIÇÕES');
}

async function loadClients() {
    if (!clientsRef) {
        console.error('❌ clientsRef não está disponível!');
        return;
    }

    try {
        const clientSelects = document.querySelectorAll('#clientSelect, #appointmentFormContainerClone #clientSelect');
        
        if (clientSelects.length === 0) {
            console.warn('⚠️ Nenhum select de cliente encontrado no DOM');
            return;
        }

        const snapshot = await clientsRef.orderBy('name').get();

        clientSelects.forEach((select, index) => {
            select.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecione um cliente';
            select.appendChild(defaultOption);
            
            if (snapshot.empty) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Nenhum cliente cadastrado';
                option.disabled = true;
                select.appendChild(option);
            } else {
                snapshot.forEach(doc => {
                    const client = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = `${client.name}${client.phone ? ` - ${client.phone}` : ''}`;
                    select.appendChild(option);
                });
            }
        });

        console.log(`✅ ${snapshot.size} cliente(s) carregado(s)`);
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        showAlert('error', `Erro ao carregar clientes: ${error.message}`);
    }
}

async function loadServices() {
    if (!servicesRef) return;

    try {
        const serviceSelects = document.querySelectorAll('#serviceSelect, #appointmentFormContainerClone #serviceSelect');
        if (serviceSelects.length === 0) return;

        const snapshot = await servicesRef.orderBy('name').get();

        serviceSelects.forEach(select => {
            const defaultOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(defaultOption);
            
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const service = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = `${service.name} - R$ ${(service.price || 0).toFixed(2).replace('.', ',')}`;
                    option.dataset.price = service.price || 0;
                    select.appendChild(option);
                });
            }
        });

        console.log(`${snapshot.size} serviço(s) carregado(s)`);
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

        let query = appointmentsRef.orderBy('date', 'desc');
        
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

        const appointmentsData = [];

        for (const doc of snapshot.docs) {
            const appointment = doc.data();
            appointment.id = doc.id;

            if (appointment.date) {
                if (typeof appointment.date === 'string') {
                    const dateObj = new Date(appointment.date + 'T00:00:00');
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    appointment.date = `${year}-${month}-${day}`;
                } else if (appointment.date.toDate) {
                    const dateObj = appointment.date.toDate();
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    appointment.date = `${year}-${month}-${day}`;
                }
            }

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

        updateUI(appointmentsData);

    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showAlert('error', 'Erro ao carregar agendamentos: ' + error.message);
    }
}

function updateUI(appointmentsData) {
    if (document.getElementById('calendarWeekBody')) {
        renderCalendar();
    }

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
        
        const querySnapshot = await appointmentsRef
            .where('barber', '==', appointmentData.barber)
            .where('date', '==', appointmentData.date)
            .where('time', '==', appointmentData.time)
            .get();

        if (querySnapshot.empty) {
            return false;
        }

        for (const doc of querySnapshot.docs) {
            if (excludeId && doc.id === excludeId) {
                continue;
            }

            const existing = doc.data();
            if (existing.status !== 'Cancelado') {
                return true;
            }
        }

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
        
        if (!isAdmin && currentUserBarber && appointment.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode editar seus próprios agendamentos');
            return;
        }
        
        currentAppointmentId = id;

        document.getElementById('clientSelect').value = appointment.clientId || '';
        document.getElementById('serviceSelect').value = appointment.serviceId || '';
        document.getElementById('barberSelect').value = appointment.barber || '';
        document.getElementById('appointmentDate').value = appointment.date || '';
        document.getElementById('appointmentTime').value = appointment.time || '';
        document.getElementById('appointmentStatus').value = appointment.status || 'Agendado';
        document.getElementById('appointmentNotes').value = appointment.notes || '';

        const dateField = document.getElementById('appointmentDate');
        if (dateField) {
            dateField.removeAttribute('min');
        }

        showAppointmentForm();
        
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
    if (!confirm('🗑️ Tem certeza que deseja EXCLUIR este agendamento?\n\nEsta ação não pode ser desfeita.')) {
        return;
    }

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
            `🗑️ Agendamento EXCLUÍDO!\n\n` +
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
    if (!confirm('✅ Marcar este agendamento como CONCLUÍDO?')) {
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
        
        if (!isAdmin && currentUserBarber && appointmentData.barber !== currentUserBarber) {
            showAlert('error', '❌ Você só pode concluir seus próprios agendamentos');
            return;
        }
        
        const clientId = appointmentData.clientId;
        const serviceId = appointmentData.serviceId;

        let clientName = 'Cliente';
        let serviceName = 'Serviço';
        let servicePrice = 0;

        if (clientId) {
            const clientDoc = await clientsRef.doc(clientId).get();
            if (clientDoc.exists) {
                clientName = clientDoc.data().name || 'Cliente';
            }
        }

        if (serviceId) {
            const serviceDoc = await servicesRef.doc(serviceId).get();
            if (serviceDoc.exists) {
                const serviceData = serviceDoc.data();
                serviceName = serviceData.name || 'Serviço';
                servicePrice = serviceData.price || 0;
            }
        }

        await appointmentsRef.doc(id).update({
            status: 'Concluído',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeModal();

        showAlert('success',
            `🎉 AGENDAMENTO CONCLUÍDO!\n\n` +
            `✅ Status: CONCLUÍDO\n` +
            `👤 Cliente: ${clientName}\n` +
            `✂️ Serviço: ${serviceName}\n` +
            `💰 Valor: R$ ${servicePrice.toFixed(2).replace('.', ',')}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}`
        );

        setTimeout(() => {
            loadAppointments();
        }, 1000);

    } catch (error) {
        console.error('Erro ao concluir agendamento:', error);
        showAlert('error', '❌ Erro ao marcar como concluído: ' + error.message);
    }
}

async function cancelAppointment(id) {
    if (!confirm('🛑 CANCELAR este agendamento?')) {
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

        await appointmentsRef.doc(id).update({
            status: 'Cancelado',
            canceledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeModal();

        showAlert('info',
            `🛑 AGENDAMENTO CANCELADO\n\n` +
            `🔴 Status: CANCELADO\n` +
            `👤 Cliente: ${clientName}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}`
        );

        setTimeout(() => {
            loadAppointments();
        }, 1000);

    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        showAlert('error', '❌ Erro ao cancelar agendamento: ' + error.message);
    }
}

async function confirmAppointment(id) {
    if (!confirm('✅ CONFIRMAR este agendamento?')) {
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

        await appointmentsRef.doc(id).update({
            status: 'Confirmado',
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeModal();

        showAlert('success',
            `✅ AGENDAMENTO CONFIRMADO!\n\n` +
            `🟢 Status: CONFIRMADO\n` +
            `👤 Cliente: ${clientName}\n` +
            `📅 Data: ${appointmentData.date}\n` +
            `⏰ Horário: ${appointmentData.time}`
        );

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

    adjustInterfaceForUserType();

    const newAppointmentBtn = document.getElementById('newAppointmentBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const appointmentForm = document.getElementById('appointmentForm');

    if (!newAppointmentBtn) {
        console.error('❌ Botão newAppointmentBtn não encontrado!');
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.textContent.includes('Novo') || btn.textContent.includes('Agendamento')) {
                btn.addEventListener('click', showAppointmentForm);
            }
        });
    } else {
        newAppointmentBtn.addEventListener('click', showAppointmentForm);
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideAppointmentForm);
    }

    if (appointmentForm) {
        appointmentForm.addEventListener('submit', saveAppointment);
    }

    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');
    const todayBtn = document.getElementById('todayBtn');

    if (prevWeekBtn) prevWeekBtn.addEventListener('click', prevWeek);
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', nextWeek);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            filterAppointments(filter);
        });
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            toggleView(view);
        });
    });

    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter) {
        if (isAdmin) {
            barberFilter.addEventListener('change', function() {
                const selectedBarber = this.value;
                filterByBarber(selectedBarber);
            });
        } else {
            barberFilter.style.display = 'none';
            const barberFilterLabel = barberFilter.previousElementSibling;
            if (barberFilterLabel && barberFilterLabel.tagName === 'STRONG') {
                barberFilterLabel.style.display = 'none';
            }
        }
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    window.currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();

    loadClients();
    loadServices();
    loadAppointments();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        setTimeout(() => {
            showAppointmentForm();
        }, 1000);
    }

    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    console.log('✅ Sistema de agendamentos inicializado - SEM RESTRIÇÕES');
}

function adjustInterfaceForUserType() {
    console.log('Ajustando interface - Modo: TODOS PODEM AGENDAR');
    
    const newAppointmentBtn = document.getElementById('newAppointmentBtn');
    if (newAppointmentBtn) {
        newAppointmentBtn.style.display = 'block';
        newAppointmentBtn.style.visibility = 'visible';
        newAppointmentBtn.disabled = false;
        newAppointmentBtn.title = 'Criar novo agendamento';
        console.log('✅ Botão de novo agendamento ativado para todos');
    }
    
    const barberFilterSection = document.querySelector('.section.mt-20');
    if (barberFilterSection) {
        if (isAdmin) {
            barberFilterSection.style.display = 'block';
        } else {
            barberFilterSection.style.display = 'none';
        }
    }
    
    const pageTitle = document.querySelector('.calendar-header h2');
    if (pageTitle && !isAdmin && currentUserBarber) {
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

        element.classList.remove('today');
        if (currentDate.toDateString() === today.toDateString()) {
            element.classList.add('today');
        }

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
    updateWeekDisplay();
}

function nextWeek() {
    const newDate = new Date(window.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    window.currentWeekStart = newDate;
    updateWeekDisplay();
}

function goToToday() {
    window.currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();
}

function renderCalendar() {
    const calendarBody = document.getElementById('calendarWeekBody');
    if (!calendarBody) return;

    calendarBody.innerHTML = '';

    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;
    const weekStart = new Date(window.currentWeekStart);

    for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'calendar-time-slot';

            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            timeSlot.appendChild(timeLabel);

            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                cell.dataset.day = dayIndex;
                cell.dataset.hour = hour;
                cell.dataset.minute = minute;

                const cellDate = new Date(weekStart);
                cellDate.setDate(weekStart.getDate() + dayIndex);
                
                const year = cellDate.getFullYear();
                const month = String(cellDate.getMonth() + 1).padStart(2, '0');
                const day = String(cellDate.getDate()).padStart(2, '0');
                const dateString = `${year}-${month}-${day}`;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (cellDate.toDateString() === today.toDateString()) {
                    cell.classList.add('today');
                }

                if (dayIndex >= 5) {
                    cell.classList.add('weekend');
                }

                // Domingo agora está aberto (removido o closed)
                // if (dayIndex === 6) {
                //     cell.classList.add('closed');
                //     cell.innerHTML = '<div class="closed-label">Fechado</div>';
                //     timeSlot.appendChild(cell);
                //     continue;
                // }

                const appointmentsForSlot = appointmentsToShow.filter(app => {
                    if (!app.date || !app.time) return false;

                    let appDateStr = app.date;
                    if (app.date.includes('/')) {
                        const parts = app.date.split('/');
                        appDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } else if (app.date.includes('T')) {
                        appDateStr = app.date.split('T')[0];
                    }
                    
                    if (appDateStr !== dateString) return false;

                    let appHour, appMinute;
                    if (app.time.includes(':')) {
                        const timeParts = app.time.split(':');
                        appHour = parseInt(timeParts[0]);
                        appMinute = parseInt(timeParts[1] || '0');
                    } else {
                        appHour = parseInt(app.time);
                        appMinute = 0;
                    }

                    const roundedMinute = Math.floor(appMinute / 30) * 30;
                    return appHour === hour && roundedMinute === minute;
                });

                appointmentsForSlot.forEach(appointment => {
                    const event = createCalendarEvent(appointment);
                    cell.appendChild(event);
                });

                timeSlot.appendChild(cell);
            }

            calendarBody.appendChild(timeSlot);
        }
    }
}

function createCalendarEvent(appointment) {
    const event = document.createElement('div');
    event.className = `calendar-event ${getStatusClass(appointment.status)}`;
    event.onclick = (e) => {
        e.stopPropagation();
        showAppointmentDetails(appointment);
    };

    let displayTime = appointment.time;
    if (displayTime && displayTime.length > 5) {
        displayTime = displayTime.substring(0, 5);
    }

    const clientName = appointment.clientName.length > 8
        ? appointment.clientName.substring(0, 8) + '...'
        : appointment.clientName;

    event.innerHTML = `
        <div class="event-time">${displayTime || ''}</div>
        <div class="event-title">${escapeHtml(clientName)}</div>
        <div class="event-barber">${appointment.barber ? appointment.barber.substring(0, 3) : ''}</div>
    `;

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

function renderAppointmentsList() {
    const appointmentsList = document.getElementById('appointmentsList');
    if (!appointmentsList) return;

    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;

    if (appointmentsToShow.length === 0) {
        appointmentsList.innerHTML = '<div class="text-center" style="padding: 20px; color: #666;">Nenhum agendamento encontrado</div>';
        return;
    }

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

    const appointmentsByDate = {};
    weekAppointments.forEach(app => {
        if (!appointmentsByDate[app.date]) {
            appointmentsByDate[app.date] = [];
        }
        appointmentsByDate[app.date].push(app);
    });

    const sortedDates = Object.keys(appointmentsByDate).sort();

    appointmentsList.innerHTML = '';

    sortedDates.forEach(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('pt-BR');

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

            const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);
            
            let actionButtons = '';
            
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

function showAppointmentDetails(appointment) {
    const modal = document.getElementById('appointmentModal');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);

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

    filteredAppointments = filtered;

    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter && isAdmin) {
        barberFilter.value = '';
    }

    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }

    if (filter !== 'all') {
        showAlert('info', `Mostrando ${filtered.length} agendamento(s) filtrado(s)`);
    }
}

function filterByBarber(barberName) {
    if (allAppointments.length === 0) {
        showAlert('info', 'Nenhum agendamento para filtrar');
        return;
    }

    let filtered = [...allAppointments];

    if (barberName && barberName !== '') {
        filtered = filtered.filter(app => app.barber === barberName);
    }

    filteredAppointments = filtered;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');

    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }

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
    
    if (isAdmin) {
        const barberFilter = document.getElementById('barberFilter');
        if (barberFilter) {
            barberFilter.value = '';
        }
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    
    filteredAppointments = [];
    
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
    const existingAlerts = document.querySelectorAll('#alertMessage');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'alertMessage';
    
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
    
    const styles = {
        success: { bg: '#d4edda', color: '#155724', border: '1px solid #c3e6cb', borderLeft: '5px solid #28a745' },
        error: { bg: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderLeft: '5px solid #dc3545' },
        info: { bg: '#d1ecf1', color: '#0c5460', border: '1px solid #bee5eb', borderLeft: '5px solid #17a2b8' },
        warning: { bg: '#fff3cd', color: '#856404', border: '1px solid #ffeaa7', borderLeft: '5px solid #ffc107' }
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
    
    document.body.appendChild(alertDiv);
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(styleSheet);
    
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

console.log('✅ Módulo de agendamentos carregado - SEM RESTRIÇÕES de data/hora');
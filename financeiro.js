// Sistema Financeiro - Bolanos Barbershop

// Variáveis globais
let db = null;
let auth = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando sistema financeiro...');
    
    // Inicializar Firebase
    initializeFirebase();
    
    // Configurar data atual no rodapé
    document.getElementById('currentYear').textContent = new Date().getFullYear();
});

// Inicializar Firebase
function initializeFirebase() {
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
        
        // Verificar autenticação
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log('Usuário autenticado:', user.email);
                document.getElementById('userName').textContent = user.email;
                loadFinancialData();
                setupEventListeners();
            } else {
                console.log('Usuário não autenticado, redirecionando...');
                window.location.href = 'login.html';
            }
        });
        
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        showAlert('error', 'Erro ao conectar ao banco de dados');
    }
}

// Configurar event listeners
function setupEventListeners() {
    const periodSelect = document.getElementById('periodSelect');
    const applyCustomDate = document.getElementById('applyCustomDate');
    const exportData = document.getElementById('exportData');
    
    if (periodSelect) {
        periodSelect.addEventListener('change', handlePeriodChange);
    }
    
    if (applyCustomDate) {
        applyCustomDate.addEventListener('click', loadFinancialData);
    }
    
    if (exportData) {
        exportData.addEventListener('click', exportFinancialData);
    }
    
    // Configurar datas padrão
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate && endDate) {
        startDate.value = firstDay.toISOString().split('T')[0];
        endDate.value = today.toISOString().split('T')[0];
    }
}

// Manipular mudança de período
function handlePeriodChange() {
    const period = document.getElementById('periodSelect').value;
    const customPeriodDiv = document.getElementById('customPeriod');
    
    if (period === 'custom') {
        customPeriodDiv.style.display = 'flex';
        customPeriodDiv.style.gap = '10px';
        customPeriodDiv.style.alignItems = 'center';
    } else {
        customPeriodDiv.style.display = 'none';
        loadFinancialData();
    }
}

// Carregar dados financeiros
async function loadFinancialData() {
    if (!db) {
        showAlert('error', 'Banco de dados não disponível');
        return;
    }
    
    try {
        console.log('Carregando dados financeiros...');
        
        // Determinar período
        const period = document.getElementById('periodSelect').value;
        let startDate, endDate;
        
        const today = new Date();
        
        switch (period) {
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'week':
                startDate = new Date(today);
                startDate.setDate(today.getDate() - today.getDay());
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                break;
            case 'custom':
                const startInput = document.getElementById('startDate').value;
                const endInput = document.getElementById('endDate').value;
                startDate = new Date(startInput);
                endDate = new Date(endInput);
                break;
            default:
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        
        // Ajustar horas
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        console.log('Período:', startDate.toLocaleDateString(), 'até', endDate.toLocaleDateString());
        
        // Buscar todos os agendamentos
        const appointmentsSnapshot = await db.collection('appointments').get();
        
        if (appointmentsSnapshot.empty) {
            console.log('Nenhum agendamento encontrado');
            updateSummaryCards(0, 0, 0);
            updateDetailedReport([], 0);
            updateBarberPerformance(new Map());
            return;
        }
        
        // Processar dados
        const appointmentsData = [];
        let totalRevenue = 0;
        let servicesCount = 0;
        const servicesMap = new Map();
        const barberMap = new Map();
        const dailyRevenue = new Map();
        
        for (const doc of appointmentsSnapshot.docs) {
            const appointment = doc.data();
            
            // Converter data
            const appointmentDate = new Date(appointment.date);
            
            // Verificar se está no período
            if (appointmentDate < startDate || appointmentDate > endDate) {
                continue;
            }
            
            // Verificar se está concluído
            if (appointment.status !== 'Concluído') {
                continue;
            }
            
            // Buscar detalhes do serviço
            let servicePrice = 0;
            let serviceName = 'Serviço';
            
            if (appointment.serviceId) {
                try {
                    const serviceDoc = await db.collection('services').doc(appointment.serviceId).get();
                    if (serviceDoc.exists) {
                        const serviceData = serviceDoc.data();
                        servicePrice = serviceData.price || 0;
                        serviceName = serviceData.name || 'Serviço';
                        
                        // Contar serviços
                        servicesMap.set(serviceName, (servicesMap.get(serviceName) || 0) + 1);
                    }
                } catch (error) {
                    console.error('Erro ao buscar serviço:', error);
                }
            }
            
            // Buscar nome do cliente
            let clientName = 'Cliente';
            if (appointment.clientId) {
                try {
                    const clientDoc = await db.collection('clients').doc(appointment.clientId).get();
                    if (clientDoc.exists) {
                        clientName = clientDoc.data().name || 'Cliente';
                    }
                } catch (error) {
                    console.error('Erro ao buscar cliente:', error);
                }
            }
            
            // Atualizar estatísticas
            totalRevenue += servicePrice;
            servicesCount++;
            
            // Atualizar dados por barbeiro
            const barberName = appointment.barber || 'Não especificado';
            const barberData = barberMap.get(barberName) || { services: 0, revenue: 0 };
            barberData.services++;
            barberData.revenue += servicePrice;
            barberMap.set(barberName, barberData);
            
            // Atualizar receita por dia
            const dateKey = appointment.date;
            dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + servicePrice);
            
            // Adicionar ao relatório
            appointmentsData.push({
                date: appointment.date,
                clientName,
                serviceName,
                barber: barberName,
                price: servicePrice,
                status: appointment.status
            });
        }
        
        console.log(`Processados ${appointmentsData.length} agendamentos no período`);
        
        // Atualizar interface
        updateSummaryCards(totalRevenue, servicesCount, appointmentsData.length > 0 ? totalRevenue / appointmentsData.length : 0);
        updateDetailedReport(appointmentsData, totalRevenue);
        updateBarberPerformance(barberMap);
        updateCharts(dailyRevenue, servicesMap);
        updateMostPopularService(servicesMap);
        
    } catch (error) {
        console.error('Erro ao carregar dados financeiros:', error);
        showAlert('error', 'Erro ao carregar dados financeiros: ' + error.message);
    }
}

// Atualizar cards de resumo
function updateSummaryCards(totalRevenue, servicesCount, averagePerClient) {
    document.getElementById('monthRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('servicesCompleted').textContent = servicesCount;
    document.getElementById('averagePerClient').textContent = formatCurrency(averagePerClient);
}

// Atualizar serviço mais popular
function updateMostPopularService(servicesMap) {
    let mostPopular = { name: '-', count: 0 };
    
    for (const [name, count] of servicesMap) {
        if (count > mostPopular.count) {
            mostPopular = { name, count };
        }
    }
    
    document.getElementById('mostPopularService').textContent = 
        mostPopular.count > 0 ? `${mostPopular.name} (${mostPopular.count})` : '-';
}

// Atualizar relatório detalhado
function updateDetailedReport(appointmentsData, totalRevenue) {
    const tableBody = document.querySelector('#financialReportTable tbody');
    const totalRevenueElement = document.getElementById('totalRevenue');
    
    if (!tableBody || !totalRevenueElement) return;
    
    tableBody.innerHTML = '';
    
    if (appointmentsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum serviço encontrado no período</td></tr>';
        totalRevenueElement.textContent = 'R$ 0,00';
        return;
    }
    
    // Ordenar por data (mais recente primeiro)
    appointmentsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    appointmentsData.forEach(appointment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(appointment.date)}</td>
            <td>${appointment.clientName}</td>
            <td>${appointment.serviceName}</td>
            <td>${appointment.barber}</td>
            <td>R$ ${appointment.price.toFixed(2)}</td>
            <td><span class="status-badge">${appointment.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
    
    totalRevenueElement.textContent = formatCurrency(totalRevenue);
}

// Atualizar desempenho por barbeiro
function updateBarberPerformance(barberMap) {
    const tableBody = document.querySelector('#barberPerformanceTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (barberMap.size === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum dado disponível</td></tr>';
        return;
    }
    
    // Converter mapa para array e ordenar por receita
    const barberArray = Array.from(barberMap.entries())
        .map(([name, data]) => ({
            name,
            services: data.services,
            revenue: data.revenue,
            average: data.services > 0 ? data.revenue / data.services : 0
        }))
        .sort((a, b) => b.revenue - a.revenue);
    
    barberArray.forEach(barber => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${barber.name}</td>
            <td>${barber.services}</td>
            <td>R$ ${barber.revenue.toFixed(2)}</td>
            <td>R$ ${barber.average.toFixed(2)}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Variáveis para gráficos
let revenueChart = null;
let servicesChart = null;

// Atualizar gráficos
function updateCharts(dailyRevenue, servicesMap) {
    // Gráfico de receita por dia
    const revenueCtx = document.getElementById('revenueChart');
    if (!revenueCtx) return;
    
    // Preparar dados
    const dates = Array.from(dailyRevenue.keys()).sort();
    const revenues = dates.map(date => dailyRevenue.get(date));
    
    // Formatar datas
    const formattedDates = dates.map(date => {
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    
    // Destruir gráfico anterior
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
            labels: formattedDates,
            datasets: [{
                label: 'Receita (R$)',
                data: revenues,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderColor: 'rgba(0, 0, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
    
    // Gráfico de serviços
    const servicesCtx = document.getElementById('servicesChart');
    if (!servicesCtx) return;
    
    // Preparar dados
    const servicesArray = Array.from(servicesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const serviceNames = servicesArray.map(item => item[0]);
    const serviceCounts = servicesArray.map(item => item[1]);
    
    // Destruir gráfico anterior
    if (servicesChart) {
        servicesChart.destroy();
    }
    
    servicesChart = new Chart(servicesCtx, {
        type: 'pie',
        data: {
            labels: serviceNames,
            datasets: [{
                data: serviceCounts,
                backgroundColor: [
                    'rgba(0, 0, 0, 0.8)',
                    'rgba(51, 51, 51, 0.8)',
                    'rgba(85, 85, 85, 0.8)',
                    'rgba(119, 119, 119, 0.8)',
                    'rgba(153, 153, 153, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// Exportar dados
function exportFinancialData() {
    const rows = [['Data', 'Cliente', 'Serviço', 'Barbeiro', 'Valor (R$)', 'Status']];
    
    const tableRows = document.querySelectorAll('#financialReportTable tbody tr');
    tableRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 6) {
            rows.push([
                cells[0].textContent,
                cells[1].textContent,
                cells[2].textContent,
                cells[3].textContent,
                cells[4].textContent.replace('R$ ', ''),
                cells[5].textContent
            ]);
        }
    });
    
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('success', 'Relatório exportado com sucesso!');
}

// Funções utilitárias
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
        return 'Data inválida';
    }
}

function formatCurrency(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function showAlert(type, message) {
    // Criar alerta
    let alertDiv = document.getElementById('alertMessage');
    
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'alertMessage';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.insertBefore(alertDiv, mainContent.firstChild);
        }
    }
    
    alertDiv.innerHTML = message;
    alertDiv.style.cssText = `
        padding: 15px 20px;
        margin: 15px 0;
        border-radius: 5px;
        font-weight: bold;
    `;
    
    if (type === 'success') {
        alertDiv.style.backgroundColor = '#d4edda';
        alertDiv.style.color = '#155724';
        alertDiv.style.border = '1px solid #c3e6cb';
    } else if (type === 'error') {
        alertDiv.style.backgroundColor = '#f8d7da';
        alertDiv.style.color = '#721c24';
        alertDiv.style.border = '1px solid #f5c6cb';
    }
    
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

// Função de logout
function logout() {
    if (auth && auth.currentUser) {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        }).catch(error => {
            console.error('Erro no logout:', error);
            window.location.href = 'login.html';
        });
    } else {
        window.location.href = 'login.html';
    }
}

// Exportar funções
window.logout = logout;
window.loadFinancialData = loadFinancialData;
window.exportFinancialData = exportFinancialData;
window.handlePeriodChange = handlePeriodChange;
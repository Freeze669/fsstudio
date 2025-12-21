// Test des fonctions financières
console.log('=== TEST DES FONCTIONS FINANCIÈRES ===');

// Test d'ajout de revenus
console.log('Test ajout de revenus...');
addRevenue(100, 'streaming', 'Test streaming revenue');
addRevenue(50, 'donations', 'Test donation');
addRevenue(25, 'ads', 'Test advertisement');

console.log('Revenus après ajout:', financialData.revenue);

// Test d'ajout de dépenses
console.log('Test ajout de dépenses...');
addExpense(30, 'server', 'Test server cost');
addExpense(20, 'marketing', 'Test marketing expense');

console.log('Dépenses après ajout:', financialData.expenses);

// Test de création de budget
console.log('Test création de budget...');
createBudget('Marketing', 500);
createBudget('Serveur', 200);

console.log('Budgets créés:', financialData.budgets);

// Test d'ajustement de portefeuille
console.log('Test ajustement portefeuille...');
adjustWallet('DIRECTEUR2024', 50);

console.log('Test terminé - vérifiez la console pour les résultats détaillés');
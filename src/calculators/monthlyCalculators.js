// Monthly calculation logic for Payroll and Sales Tax

export function calculatePayrollSetup(type) {
  return type === 'New' ? 150 : '';
}

export function calculateSalesTaxSetup(type, certificates) {
  if (type === 'New') {
    const num = parseInt(certificates, 10);
    return num > 0 ? 150 * num : 150;
  }
  return '';
}

export function calculatePayrollRate(employees) {
  const n = parseInt(employees, 10);
  if (!n || n < 1) return '';
  let total = 0;
  if (n >= 1) total += 75;
  if (n >= 2) total += 20 * Math.min(2, n - 1);
  if (n >= 4) total += 15 * (n - 3);
  return total;
}

// Given an array of certificate counts per row, return an array of rates per row
export function calculateSalesTaxRates(certRows) {
  let totalCerts = 0;
  return certRows.map(certStr => {
    const certs = parseInt(certStr, 10) || 0;
    let rowTotal = 0;
    for (let i = 1; i <= certs; i++) {
      totalCerts++;
      if (totalCerts <= 5) rowTotal += 90;
      else if (totalCerts <= 10) rowTotal += 75;
      else rowTotal += 60;
    }
    return rowTotal;
  });
}

// Bookkeeping calculation functions

// Helper function to round UP to the nearest 0 or 5
export function roundUpToNearestFiveOrZero(value) {
  if (value === 0) return 0;
  const ones = value % 10;
  if (ones === 0 || ones === 5) return value;
  if (ones < 5) return value + (5 - ones);
  return value + (10 - ones);
}

// Calculate flat fee based on account position (1st, 2nd/3rd, 4th+)
export function calculateBooksFlatFee(accountIndex) {
  if (accountIndex === 0) return 25; // First account
  if (accountIndex === 1 || accountIndex === 2) return 20; // Second and third accounts
  return 15; // Fourth and beyond
}

// Calculate transaction fees based on business rules
export function calculateTransactionFees(averageTotal, averageDeposits, accountType) {
  const total = parseInt(averageTotal, 10) || 0;
  const depositsNum = parseInt(averageDeposits, 10) || 0;
  
  if (total === 0) return 0;
  
  // For Jobox, Paypal, Amazon - flat fee only, no transaction fees
  if (['Jobox', 'Paypal', 'Amazon'].includes(accountType)) {
    return 0;
  }
  
  let transactionFee = 0;
  
  // If average transactions > 150 AND average deposits >= 50% of average total transactions
  if (total > 150 && depositsNum >= total * 0.5) {
    // Deposits at $0.425 per transaction
    transactionFee += depositsNum * 0.425;
    // Remaining transactions at $0.85
    transactionFee += (total - depositsNum) * 0.85;
  } else {
    // All transactions at $0.85
    transactionFee = total * 0.85;
  }
  
  return transactionFee;
}

// Calculate total monthly rate for an account
export function calculateBooksAccountRate(accountIndex, accountType, averageTotal, averageDeposits, averageChecks) {
  // For Jobox, Paypal, Amazon - flat fee only
  if (['Jobox', 'Paypal', 'Amazon'].includes(accountType)) {
    return 55;
  }
  
  // Calculate flat fee based on account position
  const flatFee = calculateBooksFlatFee(accountIndex);
  
  // Calculate transaction fees based on averages
  const transactionFees = calculateTransactionFees(averageTotal, averageDeposits, accountType);
  
  const total = flatFee + transactionFees;
  
  // Round UP to the nearest 0 or 5
  return roundUpToNearestFiveOrZero(Math.ceil(total));
}

// Calculate averages for an account's transaction data
export function calculateAccountAverages(transactionData) {
  if (!transactionData || transactionData.length === 0) {
    return { total: 0, deposits: 0, checks: 0 };
  }
  
  const totals = transactionData.reduce((acc, month) => {
    acc.total += parseInt(month.total, 10) || 0;
    acc.deposits += parseInt(month.deposits, 10) || 0;
    acc.checks += parseInt(month.checks, 10) || 0;
    return acc;
  }, { total: 0, deposits: 0, checks: 0 });
  
  const count = transactionData.length;
  
  // Round averages UP to the nearest 0 or 5
  return {
    total: roundUpToNearestFiveOrZero(Math.ceil(totals.total / count)),
    deposits: roundUpToNearestFiveOrZero(Math.ceil(totals.deposits / count)),
    checks: roundUpToNearestFiveOrZero(Math.ceil(totals.checks / count))
  };
}

// Calculate total books rate with $110 minimum
export function calculateTotalBooksRate(accounts, newAccountChecks = [], calculateAccountDataFunc) {
  const totalRate = accounts.reduce((sum, acc, idx) => {
    let rate;
    const isNewAccount = !!newAccountChecks[idx];
    if (isNewAccount) {
      // For new accounts, calculate based on entered transactions or use default 30
      const calc = calculateAccountDataFunc(acc, idx);
      const enteredTotal = calc.averages.total;
      
      // Use the higher of entered transactions or default 30
      const effectiveTotal = Math.max(enteredTotal, 30);
      const effectiveDeposits = enteredTotal > 30 ? calc.averages.deposits : 0;
      const effectiveChecks = enteredTotal > 30 ? calc.averages.checks : 0;
      
      rate = calculateBooksAccountRate(idx, acc.accountType, effectiveTotal, effectiveDeposits, effectiveChecks);
    } else {
      const calc = calculateAccountDataFunc(acc, idx);
      rate = calc.rate;
    }
    return sum + rate;
  }, 0);
  
  // Apply $110 minimum fee rule
  return Math.max(totalRate, 110);
}

// Check if deposits are required (more than 150 average transactions)
export function isDepositsRequired(averageTotal) {
  return averageTotal > 150;
}

// Check if checks are required (more than 50 average transactions for Checking/Savings)
export function isChecksRequired(averageTotal, accountType) {
  if (accountType !== 'Checking' && accountType !== 'Savings') return false;
  return averageTotal > 50;
} 
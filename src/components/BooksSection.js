import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import './BooksSection.css';
import { 
  calculateBooksAccountRate, 
  calculateAccountAverages, 
  calculateTotalBooksRate,
  isDepositsRequired, 
  isChecksRequired 
} from '../calculators/monthlyCalculators';

const initialAccount = {
  bankName: '',
  lastFour: '',
  accountType: 'Checking', // Default to Checking
  startingMonth: '',
  removedMonths: [], // Track which months are removed
  includedMonths: [], // Track included months for annual flat fees
  transactions: {}, // Track transaction data for each month
};

const accountTypes = [
  'Checking',
  'Savings', 
  'Credit Card',
  'Jobox',
  'Paypal',
  'Amazon'
];

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const topBanks = [
  'JPMorgan Chase',
  'Bank of America',
  'Wells Fargo',
  'American Express',
  'Citibank',
  'U.S. Bank',
  'PNC Bank',
  'Truist',
  'Goldman Sachs',
  'TD Bank',
  'Capital One',
  'Fifth Third Bank',
  'HSBC',
  'Ally Bank',
  'KeyBank',
];

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Helper function to get relevant months based on frequency and current date
const getRelevantMonths = (frequency) => {
  if (frequency === 'annual') {
    return months; // Show all months for annual service
  }
  
  // For monthly service, get current date info
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11 (Jan = 0, Dec = 11)
  const currentYear = now.getFullYear();
  
  // Check if we're in Q1 (January, February, March)
  const isQ1 = currentMonth <= 2; // 0, 1, 2 correspond to Jan, Feb, Mar
  
  if (isQ1) {
    return months; // Show full year if in Q1
  }
  
  // For other months, show up to one month ago
  const monthsToShow = currentMonth; // This gives us months 0 to currentMonth-1
  return months.slice(0, monthsToShow);
};

// Helper function to get starting month index
const getStartingMonthIndex = (startingMonth) => {
  if (!startingMonth) return 0; // Default to January if no starting month
  const monthIndex = months.findIndex(month => 
    month.toLowerCase() === startingMonth.toLowerCase()
  );
  return monthIndex >= 0 ? monthIndex : 0;
};

// Helper function to get available months for an account
const getAvailableMonths = (account, frequency) => {
  const startingMonthIndex = getStartingMonthIndex(account.startingMonth);
  const relevantMonths = getRelevantMonths(frequency);
  
  // Find the intersection of relevant months and months from starting month onwards
  const availableMonths = [];
  for (let i = startingMonthIndex; i < months.length; i++) {
    if (relevantMonths.includes(months[i])) {
      availableMonths.push(months[i]);
    }
  }
  
  // Filter out removed months
  return availableMonths.filter((month, index) => {
    const actualMonthIndex = startingMonthIndex + index;
    return !account.removedMonths.includes(actualMonthIndex);
  });
};

// Helper to determine if "NEW ACCOUNT" option is available
function isNewAccountAvailable(startingMonth) {
  if (!startingMonth) return false;
  const now = new Date();
  const currentMonthIdx = now.getMonth(); // 0-based
  const monthIdx = months.findIndex(m => m === startingMonth);
  if (monthIdx === -1) return false;
  // If starting month is within last 3 months (including current)
  return (currentMonthIdx - monthIdx) >= 0 && (currentMonthIdx - monthIdx) < 3;
}

const BooksSection = forwardRef(({ frequency = 'monthly', selectedYear = '', onAnyInputChange, setTotals, showErrorTooltip = false }, ref) => {
  const [accounts, setAccounts] = useState([{ ...initialAccount }]);
  const [errors, setErrors] = useState([{}]);
  const [newAccountChecks, setNewAccountChecks] = useState([]); // one per account
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null); // which account is being confirmed for delete

  const handleAddAccount = () => {
    setAccounts((prev) => [...prev, { ...initialAccount, accountType: '' }]);
    setErrors((prev) => [...prev, {}]);
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleInputChange = (idx, field, value) => {
    setAccounts((prev) =>
      prev.map((acc, i) =>
        i === idx ? { ...acc, [field]: value } : acc
      )
    );
    
    // Clear error when user starts typing
    if (errors[idx] && errors[idx][field]) {
      setErrors(prev => 
        prev.map((err, i) => 
          i === idx ? { ...err, [field]: false } : err
        )
      );
    }
    
    // If starting month changed, clear all transaction-related errors for this account
    if (field === 'startingMonth' || field === 'accountType') {
      setErrors(prev => 
        prev.map((err, i) => {
          if (i !== idx) return err;
          const newErr = { ...err };
          // Remove all transaction errors
          Object.keys(newErr).forEach(key => {
            if (key.startsWith('total_') || key.startsWith('deposits_') || key.startsWith('checks_')) {
              delete newErr[key];
            }
          });
          return newErr;
        })
      );
    }
    
    if (onAnyInputChange) onAnyInputChange();
  };

  // Handle transaction data changes
  const handleTransactionChange = (accountIdx, month, field, value) => {
    setAccounts(prev => 
      prev.map((acc, i) => {
        if (i !== accountIdx) return acc;
        
        const updatedTransactions = {
          ...acc.transactions,
          [month]: {
            ...acc.transactions[month],
            [field]: value
          }
        };
        
        return {
          ...acc,
          transactions: updatedTransactions
        };
      })
    );
    
    // Clear the specific error for this field immediately
    setErrors(prev => 
      prev.map((err, i) => {
        if (i !== accountIdx) return err;
        const newErr = { ...err };
        const errorKey = `${field}_${month}`;
        if (newErr[errorKey]) {
          delete newErr[errorKey];
        }
        return newErr;
      })
    );
    
    if (onAnyInputChange) onAnyInputChange();
  };



  // Calculate averages and rates for an account
  const calculateAccountData = (account, accountIdx) => {
    const availableMonths = getAvailableMonths(account, frequency);
    const transactionData = availableMonths.map(month => account.transactions[month] || {});
    
    const averages = calculateAccountAverages(transactionData);
    const rate = calculateBooksAccountRate(
      accountIdx,
      account.accountType,
      averages.total,
      averages.deposits,
      averages.checks
    );
    
    return { averages, rate };
  };

  // Validation function for a single account
  const validateAccount = (account, idx) => {
    const accountErrors = {};
    // Bank name is always required
    if (!account.bankName.trim()) {
      accountErrors.bankName = true;
    }
    // Last four is always required
    if (!account.lastFour.trim()) {
      accountErrors.lastFour = true;
    }
    // Account type validation - first account can have 'Checking' as valid
    if (idx === 0) {
      if (!account.accountType || account.accountType === '') {
        accountErrors.accountType = true;
      }
    } else {
      if (!account.accountType || account.accountType === '') {
        accountErrors.accountType = true;
      }
    }
    // Starting month is always required
    if (!account.startingMonth || account.startingMonth === '') {
      accountErrors.startingMonth = true;
    }

    // Check if this account is marked as a new account
    const isNewAccount = !!newAccountChecks[idx];

    // Validate all visible months/fields
    const type = account.accountType;
    const showDepositsChecks = type === 'Checking' || type === 'Savings';
    const showTotal = type === 'Checking' || type === 'Savings' || type === 'Credit Card';
    const isFlatFee = type === 'Jobox' || type === 'Paypal' || type === 'Amazon';
    const isAnnualFlatFee = isFlatFee && frequency === 'annual';
    const isMonthlyFlatFee = isFlatFee && frequency === 'monthly';

    // Validate transaction fields if not a flat fee account
    if (!isFlatFee) {
      const availableMonths = getAvailableMonths(account, frequency);
      const type = account.accountType;
      const showDepositsChecks = type === 'Checking' || type === 'Savings';
      const showTotal = type === 'Checking' || type === 'Savings' || type === 'Credit Card';
      const averages = calculateAccountAverages(availableMonths.map(month => account.transactions[month] || {}));
      
      // For new accounts, use the higher of entered transactions or default 30
      const effectiveTotal = isNewAccount ? Math.max(averages.total, 30) : averages.total;
      
      // Business rules for validation: deposits required if avg > 150, checks required if avg > 50
      const depositsRequired = showDepositsChecks && isDepositsRequired(effectiveTotal);
      const checksRequired = showDepositsChecks && isChecksRequired(effectiveTotal, type);
      
      availableMonths.forEach(month => {
        const tx = account.transactions[month] || {};
        
        // For new accounts, transaction fields are optional
        if (!isNewAccount) {
          // Total is always required for visible months if showTotal - must be a positive number
          if (showTotal && (tx.total === undefined || tx.total === '' || isNaN(Number(tx.total)) || Number(tx.total) <= 0)) {
            accountErrors[`total_${month}`] = true;
          }
        }
        
        // Deposits required only if depositsRequired (enabled) - must be >= 0 (can be 0)
        if (showDepositsChecks && depositsRequired) {
          if (tx.deposits === undefined || tx.deposits === '' || isNaN(Number(tx.deposits)) || Number(tx.deposits) < 0) {
            accountErrors[`deposits_${month}`] = true;
          }
        }
        // Checks required only if checksRequired (enabled) - must be >= 0 (can be 0)
        if (showDepositsChecks && checksRequired) {
          if (tx.checks === undefined || tx.checks === '' || isNaN(Number(tx.checks)) || Number(tx.checks) < 0) {
            accountErrors[`checks_${month}`] = true;
          }
        }
      });
    }
    // For annual flat fee, no transaction fields required
    // For monthly flat fee, no transaction fields required
    // For new accounts, no transaction fields required
    return accountErrors;
  };

  // Function to validate all accounts
  const validateAllAccounts = () => {
    const newErrors = accounts.map((account, idx) => validateAccount(account, idx));
    setErrors(newErrors);
    
    // For annual frequency, also validate year selection
    const hasAccountErrors = newErrors.some(accountErrors => Object.values(accountErrors).some(error => error));
    const hasYearError = frequency === 'annual' && !selectedYear;
    
    return !hasAccountErrors && !hasYearError;
  };

  // Compute if there are any errors in the section
  const hasSectionError = errors.some(accountErrors => Object.values(accountErrors).some(Boolean)) || 
                          (frequency === 'annual' && !selectedYear);

  // Generate user-friendly error messages for the first few errors
  function getErrorMessages() {
    const messages = [];
    
    // Check for year validation error first (for annual)
    if (frequency === 'annual' && !selectedYear) {
      messages.push('Year selection is required for annual quotes.');
    }
    
    errors.forEach((accountErrors, accIdx) => {
      Object.entries(accountErrors).forEach(([key, value]) => {
        if (value) {
          // Parse the key for transaction fields
          if (key.startsWith('total_')) {
            const month = key.replace('total_', '');
            messages.push(`Total for ${month} is required.`);
          } else if (key.startsWith('deposits_')) {
            const month = key.replace('deposits_', '');
            messages.push(`Deposits for ${month} is required.`);
          } else if (key.startsWith('checks_')) {
            const month = key.replace('checks_', '');
            messages.push(`Checks for ${month} is required.`);
          } else if (key === 'bankName') {
            messages.push('Bank name is required.');
          } else if (key === 'lastFour') {
            messages.push('Last four digits are required.');
          } else if (key === 'accountType') {
            messages.push('Account type is required.');
          } else if (key === 'startingMonth') {
            messages.push('Starting month is required.');
          }
        }
      });
    });
    return messages;
  }
  const errorMessages = hasSectionError ? getErrorMessages() : [];
  // Split errors into two columns if there are more than 8
  let errorColumns = [errorMessages];
  if (errorMessages.length > 8) {
    const mid = Math.ceil(errorMessages.length / 2);
    errorColumns = [errorMessages.slice(0, mid), errorMessages.slice(mid)];
  }

  // Expose validation function to parent
  useImperativeHandle(ref, () => ({
    validate: validateAllAccounts,
    hasData: () => {
      // Check if any account has meaningful data
      return accounts.some(account => 
        account.bankName || 
        account.lastFour || 
        (account.accountType && account.accountType !== 'Checking') ||
        account.startingMonth ||
        Object.keys(account.transactions || {}).length > 0
      );
    },
    getAnnualAccountData: () => {
      // Return account data for annual calculations
      return accounts.map(account => {
        const availableMonths = getAvailableMonths(account, 'annual');
        const accountData = {};
        
        // For each available month, calculate the rate for this account
        availableMonths.forEach(month => {
          const isNewAccount = !!newAccountChecks[accounts.indexOf(account)];
          let monthRate = 0;
          
          if (isNewAccount) {
            // For new accounts, calculate based on entered transactions or use default 30
            const calc = calculateAccountData(account, accounts.indexOf(account));
            const enteredTotal = calc.averages.total;
            
            // Use the higher of entered transactions or default 30
            const effectiveTotal = Math.max(enteredTotal, 30);
            const effectiveDeposits = enteredTotal > 30 ? calc.averages.deposits : 0;
            const effectiveChecks = enteredTotal > 30 ? calc.averages.checks : 0;
            
            monthRate = calculateBooksAccountRate(accounts.indexOf(account), account.accountType, effectiveTotal, effectiveDeposits, effectiveChecks);
          } else {
            // Calculate based on transaction data
            const calc = calculateAccountData(account, accounts.indexOf(account));
            monthRate = calc.rate;
          }
          
          accountData[month] = {
            rate: monthRate,
            accountType: account.accountType,
            bankName: account.bankName,
            isNewAccount
          };
        });
        
        return {
          bankName: account.bankName,
          accountType: account.accountType,
          startingMonth: account.startingMonth,
          availableMonths,
          monthlyData: accountData
        };
      }).filter(account => account.availableMonths.length > 0); // Only return accounts with active months
    },
    getDetailedAccountData: () => {
      // Return detailed account data for PDF generation
      return accounts.map((account, accountIdx) => {
        const availableMonths = getAvailableMonths(account, 'monthly');
        const isNewAccount = !!newAccountChecks[accountIdx];
        
        // Calculate averages
        let averages = { total: 0, deposits: 0, checks: 0 };
        if (isNewAccount) {
          // For new accounts, calculate based on entered transactions or use default 30
          const calc = calculateAccountData(account, accountIdx);
          const enteredTotal = calc.averages.total;
          
          // Use the higher of entered transactions or default 30
          const effectiveTotal = Math.max(enteredTotal, 30);
          const effectiveDeposits = enteredTotal > 30 ? calc.averages.deposits : 0;
          const effectiveChecks = enteredTotal > 30 ? calc.averages.checks : 0;
          
          averages = { 
            total: effectiveTotal, 
            deposits: effectiveDeposits, 
            checks: effectiveChecks 
          };
        } else {
          const calc = calculateAccountData(account, accountIdx);
          averages = calc.averages;
        }
        
        // Get monthly transaction data
        const monthlyTransactions = {};
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        
        months.forEach(month => {
          if (account.transactions && account.transactions[month]) {
            monthlyTransactions[month] = {
              total: account.transactions[month].total || 0,
              deposits: account.transactions[month].deposits || 0,
              checks: account.transactions[month].checks || 0
            };
          } else {
            monthlyTransactions[month] = { total: 0, deposits: 0, checks: 0 };
          }
        });
        
        // Calculate monthly rate
        const monthlyRate = isNewAccount ? 
          calculateBooksAccountRate(accountIdx, account.accountType, averages.total, averages.deposits, averages.checks) :
          calculateAccountData(account, accountIdx).rate;
        
        return {
          bankName: account.bankName || 'Unknown Bank',
          accountType: account.accountType || 'Checking',
          lastFour: account.lastFour || 'N/A',
          startingMonth: account.startingMonth || 'January',
          monthlyRate,
          isNewAccount,
          averages,
          monthlyTransactions,
          availableMonths
        };
      }).filter(account => account.bankName && account.accountType); // Only return accounts with basic info
    }
  }));

  // For last four: only allow numbers, max 4 (or 5 for Amex)
  const handleLastFourChange = (idx, value, bankName) => {
    let maxLen = 4;
    if (bankName && bankName.toLowerCase().includes('american express')) maxLen = 5;
    // Remove non-digits
    let digits = value.replace(/\D/g, '');
    if (digits.length > maxLen) digits = digits.slice(0, maxLen);
    handleInputChange(idx, 'lastFour', digits);
    if (onAnyInputChange) onAnyInputChange();
  };

  // For bank name: allow select or custom
  const handleBankNameChange = (idx, value) => {
    handleInputChange(idx, 'bankName', value);
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleRemoveAccount = (idx) => {
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
    setErrors((prev) => prev.filter((_, i) => i !== idx));
    setNewAccountChecks((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDeleteIdx(null);
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleRemoveMonth = (accountIdx, monthName) => {
    setAccounts((prev) =>
      prev.map((acc, i) => {
        if (i !== accountIdx) return acc;
        
        const startingMonthIndex = getStartingMonthIndex(acc.startingMonth);
        const relevantMonths = getRelevantMonths(frequency);
        const availableMonths = relevantMonths.slice(startingMonthIndex);
        
        // Find the index of the month to remove
        const monthIndexInAvailable = availableMonths.findIndex(m => m === monthName);
        if (monthIndexInAvailable === -1) return acc;
        
        // Calculate the actual month index in the full months array
        const actualMonthIndex = startingMonthIndex + monthIndexInAvailable;
        
        // Add this month and all subsequent months to removedMonths
        const monthsToRemove = [];
        for (let j = actualMonthIndex; j < 12; j++) {
          monthsToRemove.push(j);
        }
        
        return {
          ...acc,
          removedMonths: [...new Set([...acc.removedMonths, ...monthsToRemove])]
        };
      })
    );
    if (onAnyInputChange) onAnyInputChange();
  };

  // For annual flat fee, track checked months
  const handleFlatFeeMonthCheck = (accountIdx, month, checked) => {
    setAccounts((prev) =>
      prev.map((acc, i) => {
        if (i !== accountIdx) return acc;
        let includedMonths = acc.includedMonths || [];
        if (checked) {
          includedMonths = [...includedMonths, month];
        } else {
          includedMonths = includedMonths.filter(m => m !== month);
        }
        return { ...acc, includedMonths };
      })
    );
    if (onAnyInputChange) onAnyInputChange();
  };

  const handleNewAccountCheck = (accIdx, checked) => {
    setNewAccountChecks(prev => {
      const arr = [...prev];
      arr[accIdx] = checked;
      return arr;
    });
    
    // Clear transaction-related validation errors when new account is checked
    if (checked) {
      setErrors(prev => 
        prev.map((err, i) => {
          if (i !== accIdx) return err;
          const newErr = { ...err };
          // Remove all transaction errors
          Object.keys(newErr).forEach(key => {
            if (key.startsWith('total_') || key.startsWith('deposits_') || key.startsWith('checks_')) {
              delete newErr[key];
            }
          });
          return newErr;
        })
      );
    }
    
    if (onAnyInputChange) onAnyInputChange();
  };

  const accountRows = chunkArray(accounts, 3);

  // Helper to check if all fields in an account are empty
  const isAccountEmpty = (acc) =>
    !acc.bankName && !acc.lastFour && !acc.accountType && !acc.startingMonth;

  // Calculate total rate and setup for all accounts with $110 minimum
  const totalRate = calculateTotalBooksRate(accounts, newAccountChecks, calculateAccountData);

  const totalSetup = 0; // Books doesn't have setup fees

  // Update totals when accounts change
  useEffect(() => {
    if (setTotals) {
      setTotals({ rate: totalRate, setup: totalSetup });
    }
  }, [totalRate, totalSetup, setTotals]);

  // Trigger validation when accounts change (after state update)
  useEffect(() => {
    // Small delay to ensure state has updated
    const timer = setTimeout(() => {
      if (onAnyInputChange) onAnyInputChange();
    }, 0);
    
    return () => clearTimeout(timer);
  }, [accounts]); // Removed onAnyInputChange from dependencies to prevent infinite loop

  return (
    <>
      <hr />
      <div className={`books-section${hasSectionError ? ' section-error' : ''}`}>
        <div className="books-section-header">
          <h2 className="dashboard-title">Books</h2>
          <button className="add-account-btn" type="button" onClick={handleAddAccount}>Add Account</button>
        </div>

        {showErrorTooltip && hasSectionError && errorMessages.length > 0 && (
          <div className="section-error-tooltip">
            {errorMessages.length > 8 ? (
              <div className="error-columns">
                <ul>
                  {errorColumns[0].map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
                <ul>
                  {errorColumns[1].map((msg, i) => (
                    <li key={i + errorColumns[0].length}>{msg}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul>
                {errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {accountRows.map((row, rowIdx) => (
          <div className="books-accounts-row" key={rowIdx}>
            {row.map((acc, idx) => {
              // Calculate the absolute index in the accounts array
              const accIdx = rowIdx * 3 + idx;
              const showRemove = accIdx !== 0 && isAccountEmpty(acc);
              
              // Get available months for this account
              const availableMonths = getAvailableMonths(acc, frequency);
              
              // Calculate averages and rate for this account
              let averages, rate;
              const isNewAccount = !!newAccountChecks[accIdx];
              if (isNewAccount) {
                // For new accounts, calculate based on entered transactions or use default 30
                const calc = calculateAccountData(acc, accIdx);
                const enteredTotal = calc.averages.total;
                
                // Use the higher of entered transactions or default 30
                const effectiveTotal = Math.max(enteredTotal, 30);
                const effectiveDeposits = enteredTotal > 30 ? calc.averages.deposits : 0;
                const effectiveChecks = enteredTotal > 30 ? calc.averages.checks : 0;
                
                averages = { 
                  total: effectiveTotal, 
                  deposits: effectiveDeposits, 
                  checks: effectiveChecks 
                };
                rate = calculateBooksAccountRate(accIdx, acc.accountType, effectiveTotal, effectiveDeposits, effectiveChecks);
              } else {
                const calc = calculateAccountData(acc, accIdx);
                averages = calc.averages;
                rate = calc.rate;
              }
              
              // Determine if Amex for last four
              const isAmex = acc.bankName && acc.bankName.toLowerCase().includes('american express');
              
              // Determine columns to show based on account type
              const type = acc.accountType;
              const showDepositsChecks = type === 'Checking' || type === 'Savings';
              const showTotal = type === 'Checking' || type === 'Savings' || type === 'Credit Card';
              const isFlatFee = type === 'Jobox' || type === 'Paypal' || type === 'Amazon';
              const isAnnualFlatFee = isFlatFee && frequency === 'annual';
              const isMonthlyFlatFee = isFlatFee && frequency === 'monthly';
              
              // Apply business rules for deposits and checks
              // Deposits required if avg > 150, checks required if avg > 50
              const depositsRequired = showDepositsChecks && isDepositsRequired(averages.total);
              const checksRequired = showDepositsChecks && isChecksRequired(averages.total, type);
              
              // Determine if NEW ACCOUNT checkbox should be shown (only in monthly mode)
              const showNewAccountCheckbox = frequency === 'monthly' && isNewAccountAvailable(acc.startingMonth);
              
              // If monthly flat fee, show nothing
              if (isMonthlyFlatFee) {
                return (
                  <div className="account-card" key={accIdx}>
                    <div className="account-header">
                      <div className="header-row">
                        <div className="bank-combo-wrapper">
                          <input
                            className={`account-input bank-name${errors[accIdx]?.bankName ? ' error' : ''}`}
                            list={`bank-list-${accIdx}`}
                            placeholder="Bank Name"
                            value={acc.bankName}
                            onChange={e => handleBankNameChange(accIdx, e.target.value)}
                            autoComplete="off"
                          />
                          <datalist id={`bank-list-${accIdx}`}>
                            {topBanks.map((bank, i) => (
                              <option key={i} value={bank} />
                            ))}
                          </datalist>
                        </div>
                        <input
                          className={`account-input last-four${errors[accIdx]?.lastFour ? ' error' : ''}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={isAmex ? 'Last 5' : 'Last 4'}
                          value={acc.lastFour}
                          maxLength={isAmex ? 5 : 4}
                          onChange={e => handleLastFourChange(accIdx, e.target.value, acc.bankName)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="header-row">
                        <select
                          className={`account-input${errors[accIdx]?.accountType ? ' error' : ''}`}
                          value={acc.accountType}
                          onChange={e => handleInputChange(accIdx, 'accountType', e.target.value)}
                          disabled={accIdx === 0}
                        >
                          {accIdx === 0 ? (
                            accountTypes.map((type, typeIdx) => (
                              <option key={typeIdx} value={type}>
                                {type}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="">Type of Account</option>
                              {accountTypes.map((type, typeIdx) => (
                                <option key={typeIdx} value={type}>
                                  {type}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                        <div className="starting-month-wrapper">
                          <select
                            className={`account-input${errors[accIdx]?.startingMonth ? ' error' : ''}`}
                            value={acc.startingMonth}
                            onChange={e => handleInputChange(accIdx, 'startingMonth', e.target.value)}
                          >
                            <option value="">Starting Month</option>
                            {months.map((month, monthIdx) => (
                              <option key={monthIdx} value={month}>
                                {month}
                              </option>
                            ))}
                          </select>
                          {showRemove && (
                            <button
                              className="remove-account-btn"
                              type="button"
                              title="Remove Account"
                              onClick={() => handleRemoveAccount(accIdx)}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {showNewAccountCheckbox && (
                      <div className="new-account-checkbox-box">
                        <label className="new-account-checkbox-label">
                          <input
                            type="checkbox"
                            checked={!!newAccountChecks[accIdx]}
                            onChange={e => handleNewAccountCheck(accIdx, e.target.checked)}
                          />
                          <span>NEW ACCOUNT</span>
                        </label>
                      </div>
                    )}
                    <div className="monthly-transactions-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Month</th>
                            {showTotal && <th>Total</th>}
                            {showDepositsChecks && <th>Deposits</th>}
                            {showDepositsChecks && <th>Checks</th>}
                            {!isFlatFee && <th className="remove-header"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {availableMonths.map((month, monthIdx) => (
                            <tr key={monthIdx}>
                              <td>{month}</td>
                              {showTotal && (
                                <td>
                                  <input 
                                    type="number" 
                                    className="table-input" 
                                    placeholder="#"
                                    value={acc.transactions[month]?.total || ''}
                                    onChange={e => handleTransactionChange(accIdx, month, 'total', e.target.value)}
                                  />
                                </td>
                              )}
                              {showDepositsChecks && (
                                <td>
                                  <input 
                                    type="number" 
                                    className="table-input" 
                                    placeholder="#"
                                    value={acc.transactions[month]?.deposits || ''}
                                    onChange={e => handleTransactionChange(accIdx, month, 'deposits', e.target.value)}
                                    disabled={!depositsRequired}
                                  />
                                </td>
                              )}
                              {showDepositsChecks && (
                                <td>
                                  <input 
                                    type="number" 
                                    className="table-input" 
                                    placeholder="#"
                                    value={acc.transactions[month]?.checks || ''}
                                    onChange={e => handleTransactionChange(accIdx, month, 'checks', e.target.value)}
                                    disabled={!checksRequired}
                                  />
                                </td>
                              )}
                              {!isFlatFee && (
                                <td className="remove-cell">
                                  <button
                                    className="remove-month-btn"
                                    type="button"
                                    title="Remove Month"
                                    onClick={() => handleRemoveMonth(accIdx, month)}
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {/* Averages Row */}
                          <tr className="averages-row">
                            <td><strong>Average</strong></td>
                            {showTotal && <td><strong>{averages.total}</strong></td>}
                            {showDepositsChecks && <td><strong>{averages.deposits}</strong></td>}
                            {showDepositsChecks && <td><strong>{averages.checks}</strong></td>}
                            {!isFlatFee && (
                              <td style={{ textAlign: 'center', position: 'relative' }}>
                                {!isAccountEmpty(acc) && accIdx !== 0 && (
                                  <>
                                    <button
                                      className="remove-account-confirm-btn"
                                      type="button"
                                      onClick={() => setConfirmDeleteIdx(accIdx)}
                                    >
                                      REMOVE
                                    </button>
                                    {confirmDeleteIdx === accIdx && (
                                      <div className="remove-confirm-tooltip">
                                        <div>Are you sure you want to delete this account? This action cannot be undone.</div>
                                        <div className="remove-confirm-actions">
                                          <button className="cancel-btn" type="button" onClick={() => setConfirmDeleteIdx(null)}>Cancel</button>
                                          <button className="delete-btn" type="button" onClick={() => handleRemoveAccount(accIdx)}>Delete</button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {/* Rate Box */}
                    <div className="rate-box">
                      <div className="rate-label">Monthly Rate:</div>
                      <div className="rate-value">${rate}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="account-card" key={accIdx}>
                  <div className="account-header">
                    <div className="header-row">
                      <div className="bank-combo-wrapper">
                        <input
                          className={`account-input bank-name${errors[accIdx]?.bankName ? ' error' : ''}`}
                          list={`bank-list-${accIdx}`}
                          placeholder="Bank Name"
                          value={acc.bankName}
                          onChange={e => handleBankNameChange(accIdx, e.target.value)}
                          autoComplete="off"
                        />
                        <datalist id={`bank-list-${accIdx}`}>
                          {topBanks.map((bank, i) => (
                            <option key={i} value={bank} />
                          ))}
                        </datalist>
                      </div>
                      <input
                        className={`account-input last-four${errors[accIdx]?.lastFour ? ' error' : ''}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={isAmex ? 'Last 5' : 'Last 4'}
                        value={acc.lastFour}
                        maxLength={isAmex ? 5 : 4}
                        onChange={e => handleLastFourChange(accIdx, e.target.value, acc.bankName)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="header-row">
                      <select
                        className={`account-input${errors[accIdx]?.accountType ? ' error' : ''}`}
                        value={acc.accountType}
                        onChange={e => handleInputChange(accIdx, 'accountType', e.target.value)}
                        disabled={accIdx === 0}
                      >
                        {accIdx === 0 ? (
                          accountTypes.map((type, typeIdx) => (
                            <option key={typeIdx} value={type}>
                              {type}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="">Type of Account</option>
                            {accountTypes.map((type, typeIdx) => (
                              <option key={typeIdx} value={type}>
                                {type}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      <div className="starting-month-wrapper">
                        <select
                          className={`account-input${errors[accIdx]?.startingMonth ? ' error' : ''}`}
                          value={acc.startingMonth}
                          onChange={e => handleInputChange(accIdx, 'startingMonth', e.target.value)}
                        >
                          <option value="">Starting Month</option>
                          {months.map((month, monthIdx) => (
                            <option key={monthIdx} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                        {showRemove && (
                          <button
                            className="remove-account-btn"
                            type="button"
                            title="Remove Account"
                            onClick={() => handleRemoveAccount(accIdx)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {showNewAccountCheckbox && (
                    <div className="new-account-checkbox-box">
                      <label className="new-account-checkbox-label">
                        <input
                          type="checkbox"
                          checked={!!newAccountChecks[accIdx]}
                          onChange={e => handleNewAccountCheck(accIdx, e.target.checked)}
                        />
                        <span>NEW ACCOUNT</span>
                      </label>
                    </div>
                  )}
                  <div className="monthly-transactions-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          {showTotal && <th>Total</th>}
                          {showDepositsChecks && <th>Deposits</th>}
                          {showDepositsChecks && <th>Checks</th>}
                          {!isFlatFee && <th className="remove-header"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {availableMonths.map((month, monthIdx) => (
                          <tr key={monthIdx}>
                            <td>{month}</td>
                            {showTotal && (
                              <td>
                                <input 
                                  type="number" 
                                  className="table-input" 
                                  placeholder="Enter amount"
                                  value={acc.transactions[month]?.total || ''}
                                  onChange={e => handleTransactionChange(accIdx, month, 'total', e.target.value)}
                                />
                              </td>
                            )}
                            {showDepositsChecks && (
                              <td>
                                <input 
                                  type="number" 
                                  className="table-input" 
                                  placeholder="Enter amount"
                                  value={acc.transactions[month]?.deposits || ''}
                                  onChange={e => handleTransactionChange(accIdx, month, 'deposits', e.target.value)}
                                  disabled={!depositsRequired}
                                />
                              </td>
                            )}
                            {showDepositsChecks && (
                              <td>
                                <input 
                                  type="number" 
                                  className="table-input" 
                                  placeholder="Enter amount"
                                  value={acc.transactions[month]?.checks || ''}
                                  onChange={e => handleTransactionChange(accIdx, month, 'checks', e.target.value)}
                                  disabled={!checksRequired}
                                />
                              </td>
                            )}
                            {!isFlatFee && (
                              <td className="remove-cell">
                                <button
                                  className="remove-month-btn"
                                  type="button"
                                  title="Remove Month"
                                  onClick={() => handleRemoveMonth(accIdx, month)}
                                >
                                  ×
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {/* Averages Row */}
                        <tr className="averages-row">
                          <td><strong>Average</strong></td>
                          {showTotal && <td><strong>{averages.total}</strong></td>}
                          {showDepositsChecks && <td><strong>{averages.deposits}</strong></td>}
                          {showDepositsChecks && <td><strong>{averages.checks}</strong></td>}
                          {!isFlatFee && (
                            <td style={{ textAlign: 'center', position: 'relative' }}>
                              {!isAccountEmpty(acc) && accIdx !== 0 && (
                                <>
                                  <button
                                    className="remove-account-confirm-btn"
                                    type="button"
                                    onClick={() => setConfirmDeleteIdx(accIdx)}
                                  >
                                    REMOVE
                                  </button>
                                  {confirmDeleteIdx === accIdx && (
                                    <div className="remove-confirm-tooltip">
                                      <div>Are you sure you want to delete this account? This action cannot be undone.</div>
                                      <div className="remove-confirm-actions">
                                        <button className="cancel-btn" type="button" onClick={() => setConfirmDeleteIdx(null)}>Cancel</button>
                                        <button className="delete-btn" type="button" onClick={() => handleRemoveAccount(accIdx)}>Delete</button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Rate Box */}
                  <div className="rate-box">
                    <div className="rate-label">Monthly Rate:</div>
                    <div className="rate-value">${rate}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
});

BooksSection.displayName = 'BooksSection';

export default BooksSection;
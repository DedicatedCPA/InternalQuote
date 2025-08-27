import React, { useState, useEffect, useCallback } from 'react';
import BooksSection from './BooksSection';
import PayrollSection from './PayrollSection';
import SalesTaxSection from './SalesTaxSection';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { calculatePayrollRate, calculatePayrollSetup, calculateSalesTaxRates, calculateSalesTaxSetup } from '../calculators/monthlyCalculators';

const serviceList = [
  { key: 'books', label: 'Books' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'salesTax', label: 'Sales Tax' },
];

const stateAbbreviations = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
  'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
  'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

const Dashboard = ({ setInputChangeHandler, quoteFormRef }) => {
  const [frequency, setFrequency] = useState('monthly');
  const [selectedServices, setSelectedServices] = useState(['books']);

  // Totals for summary
  const [booksTotals, setBooksTotals] = useState({ rate: 0, setup: 0 });
  const [payrollTotals, setPayrollTotals] = useState({ rate: 0, setup: 0 });
  const [salesTaxTotals, setSalesTaxTotals] = useState({ rate: 0, setup: 0 });

  // Refs for validation
  const booksSectionRef = React.useRef();
  const payrollSectionRef = React.useRef();
  const salesTaxSectionRef = React.useRef();

  // State for service removal confirmation
  const [confirmRemoveService, setConfirmRemoveService] = useState(null); // 'payroll' or 'salesTax'
  const [confirmAnnualSwitch, setConfirmAnnualSwitch] = useState(null); // For annual frequency switch confirmation

  // Table content and labels based on frequency
  const isMonthly = frequency === 'monthly';

  // Track if quote is generated
  const [quoteGenerated, setQuoteGenerated] = useState(false);
  const [showBooksErrorTooltip, setShowBooksErrorTooltip] = useState(false);

  // Force re-validation state
  const [validationTrigger, setValidationTrigger] = useState(0);
  const [currentValidationState, setCurrentValidationState] = useState(false);
  
  // Animation state for table transitions
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle'); // 'idle', 'fadeOut', 'fadeIn'
  
  // Year selector state for annual quotes
  const [selectedYear, setSelectedYear] = useState('');
  
  // Export popup state
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [showCopyNotification, setShowCopyNotification] = useState(false);

  // Handler to reset quoteGenerated when any input changes
  const handleAnyInputChange = useCallback(() => {
    if (quoteGenerated) setQuoteGenerated(false);
    setShowBooksErrorTooltip(false); // Hide tooltip on any input change
    setConfirmRemoveService(null); // Hide service removal confirmation on any input change
    setConfirmAnnualSwitch(null); // Hide annual switch confirmation on any input change
    
    // Trigger validation re-calculation with a small delay to ensure state updates
    setTimeout(() => {
      setValidationTrigger(prev => prev + 1);
    }, 10);
  }, [quoteGenerated]);

  // Close confirmation tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (confirmRemoveService && !event.target.closest('.service-remove-tooltip') && !event.target.closest('.services-container')) {
        setConfirmRemoveService(null);
      }
      if (confirmAnnualSwitch && !event.target.closest('.annual-switch-tooltip') && !event.target.closest('.toggle-slider')) {
        setConfirmAnnualSwitch(null);
      }
    };

    if (confirmRemoveService || confirmAnnualSwitch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [confirmRemoveService, confirmAnnualSwitch]);

  // Update validation state when trigger changes
  useEffect(() => {
    const runValidation = () => {
      // Always validate QuoteForm
      const quoteFormValid = quoteFormRef.current?.validate() ?? false;
      
      // Validate BooksSection if selected
      const booksValid = selectedServices.includes('books') 
        ? booksSectionRef.current?.validate() ?? false
        : true;
      
      // Validate PayrollSection if selected
      const payrollValid = selectedServices.includes('payroll')
        ? payrollSectionRef.current?.validate() ?? false
        : true;
      
      // Validate SalesTaxSection if selected
      const salesTaxValid = selectedServices.includes('salesTax')
        ? salesTaxSectionRef.current?.validate() ?? false
        : true;
      
      // Validate year selection for annual quotes
      const yearValid = frequency === 'annual' ? selectedYear !== '' : true;
      
      const result = quoteFormValid && booksValid && payrollValid && salesTaxValid && yearValid;
      setCurrentValidationState(result);
    };

    runValidation();
  }, [selectedServices, validationTrigger, frequency, selectedYear, quoteFormRef, booksSectionRef, payrollSectionRef, salesTaxSectionRef]);

  // Service button toggle logic
  const toggleService = (key) => {
    if (key === 'books') return; // Prevent unchecking books
    
    // If service is already selected and we're trying to remove it
    if (selectedServices.includes(key)) {
      // Check if the section has data
      let hasData = false;
      if (key === 'payroll' && payrollSectionRef.current) {
        hasData = payrollSectionRef.current.hasData();
      } else if (key === 'salesTax' && salesTaxSectionRef.current) {
        hasData = salesTaxSectionRef.current.hasData();
      }
      
      // If has data, show confirmation dialog
      if (hasData) {
        setConfirmRemoveService(key);
        return;
      }
      
      // If no data, remove directly
      setSelectedServices((prev) => prev.filter((k) => k !== key));
    } else {
      // Adding service
      setSelectedServices((prev) => [...prev, key]);
    }
  };

  // Function to confirm service removal
  const confirmServiceRemoval = (key) => {
    setSelectedServices((prev) => prev.filter((k) => k !== key));
    setConfirmRemoveService(null);
  };

  // Handle frequency switching with annual confirmation logic
  const handleFrequencySwitch = (newFrequency) => {
    if (newFrequency === 'annual') {
      // Check if payroll or sales tax have data
      const servicesWithData = [];
      
      if (selectedServices.includes('payroll') && payrollSectionRef.current?.hasData()) {
        servicesWithData.push('payroll');
      }
      if (selectedServices.includes('salesTax') && salesTaxSectionRef.current?.hasData()) {
        servicesWithData.push('salesTax');
      }
      
      if (servicesWithData.length > 0) {
        // Show confirmation for services with data
        setConfirmAnnualSwitch(servicesWithData);
        return;
      } else {
        // No data, remove services and switch to annual
        setSelectedServices(['books']); // Keep only books for annual
      }
    }
    
    // Start animation sequence if frequency is actually changing
    if (frequency !== newFrequency) {
      performAnimatedFrequencySwitch(newFrequency);
    }
  };

  // Animated frequency switch with table transitions
  const performAnimatedFrequencySwitch = (newFrequency) => {
    if (isAnimating) return; // Prevent multiple animations
    
    setIsAnimating(true);
    setAnimationPhase('fadeOut');
    
    // Phase 1: Fade out current tables (300ms)
    setTimeout(() => {
      // Phase 2: Update frequency and content
      setFrequency(newFrequency);
      setAnimationPhase('fadeIn');
      
      // Phase 3: Fade in new tables (300ms)
      setTimeout(() => {
        setAnimationPhase('idle');
        setIsAnimating(false);
      }, 300);
    }, 300);
  };

  // Confirm annual switch and remove services
  const confirmAnnualSwitchAction = () => {
    setSelectedServices(['books']); // Keep only books for annual
    performAnimatedFrequencySwitch('annual');
    setConfirmAnnualSwitch(null);
  };

  // Handle year selection for annual quotes
  const handleYearChange = (year) => {
    setSelectedYear(year);
    if (handleAnyInputChange) handleAnyInputChange();
  };

  // Placeholder for Books
  const booksRate = booksTotals.rate;

  // Annual calculation functions
  const getActiveMonthsData = () => {
    // Get real account data from BooksSection
    if (!booksSectionRef.current) {
      return []; // Return empty if no data available
    }

    try {
      const accountsData = booksSectionRef.current.getAnnualAccountData();
      
      if (!accountsData || accountsData.length === 0) {
        return []; // Return empty if no accounts
      }

      // Get all unique months from all accounts
      const allMonths = new Set();
      accountsData.forEach(account => {
        account.availableMonths.forEach(month => allMonths.add(month));
      });

      // Calculate rate for each month
      const monthsArray = Array.from(allMonths);
      const activeMonths = monthsArray.map(month => {
        // Sum up rates from all accounts for this month
        let monthlyRate = 0;
        accountsData.forEach(account => {
          if (account.monthlyData[month]) {
            monthlyRate += account.monthlyData[month].rate;
          }
        });
        
        // Apply $110 minimum per month
        monthlyRate = Math.max(monthlyRate, 110);
        
        return {
          month,
          rate: monthlyRate
        };
      });

      // Sort by month order
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
      
      return activeMonths.sort((a, b) => {
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });
      
    } catch (error) {
      console.error('Error getting annual account data:', error);
      return []; // Return empty on error
    }
  };

  const calculateTotalAnnualRate = () => {
    const activeMonths = getActiveMonthsData();
    return activeMonths.reduce((total, month) => total + month.rate, 0);
  };

  // Calculate annual discount based on total annual rate
  const calculateAnnualDiscount = (totalAnnualRate) => {
    if (totalAnnualRate < 660) return 0;
    if (totalAnnualRate >= 660 && totalAnnualRate < 990) return 0.09; // 9%
    if (totalAnnualRate >= 990 && totalAnnualRate < 1190) return 0.12; // 12%
    if (totalAnnualRate >= 1190 && totalAnnualRate < 1460) return 0.15; // 15%
    if (totalAnnualRate >= 1460 && totalAnnualRate < 1700) return 0.17; // 17%
    if (totalAnnualRate >= 1700 && totalAnnualRate < 2800) return 0.20; // 20%
    if (totalAnnualRate >= 2800 && totalAnnualRate < 3000) return 0.22; // 22%
    if (totalAnnualRate >= 3000) return 0.25; // 25%
    return 0;
  };

  // Round down discount amount to nearest 5 or 0
  const roundDownToNearest5 = (amount) => {
    return Math.floor(amount / 5) * 5;
  };

  // Calculate discount amount and final discounted rate
  const getAnnualPricingData = () => {
    const totalAnnualRate = calculateTotalAnnualRate();
    const discountPercentage = calculateAnnualDiscount(totalAnnualRate);
    const rawDiscountAmount = totalAnnualRate * discountPercentage;
    const discountAmount = roundDownToNearest5(rawDiscountAmount);
    const discountedRate = totalAnnualRate - discountAmount;
    
    return {
      totalAnnualRate,
      discountPercentage,
      discountAmount,
      discountedRate
    };
  };

  // Register the input change handler for QuoteForm
  useEffect(() => {
    if (setInputChangeHandler) {
      setInputChangeHandler(() => handleAnyInputChange);
    }
  }, [setInputChangeHandler, handleAnyInputChange]);

  // Calculate validation state once per render
  const validationState = currentValidationState;

  const handleGenerateQuoteClick = () => {
    if (!validationState) {
      setShowBooksErrorTooltip(true);
      return;
    }
    setQuoteGenerated(true);
  };

  // Format date as MM/DD/YYYY
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Get company name from QuoteForm
  const getCompanyName = () => {
    try {
      const formData = quoteFormRef.current?.getFormData();
      return formData?.companyName || 'Company Name';
    } catch (error) {
      return 'Company Name';
    }
  };

  const getEmployeeName = () => {
    try {
      const formData = quoteFormRef.current?.getFormData();
      // Try different possible field names for employee
      return formData?.employeeName || formData?.employee || formData?.contactName || '';
    } catch (error) {
      return '';
    }
  };

  const generatePopupData = () => {
    if (!isMonthly) {
      return {
        isSimple: true,
        content: "Your quote has been exported as a PDF. What would you like to do next?"
      };
    }

    // Get all necessary data
    const formData = quoteFormRef.current?.getFormData?.();
    const activeMonthsData = getActiveMonthsData();
    
    // Get account details
    let accountDetails = [];
    if (booksSectionRef.current) {
      try {
        const detailedAccountsData = booksSectionRef.current.getDetailedAccountData();
        accountDetails = detailedAccountsData || [];
      } catch (error) {
        console.log('Error getting account details for popup:', error);
      }
    }

    // Find earliest and latest months
    let earliestMonth = '';
    let latestMonth = '';
    if (activeMonthsData.length > 0) {
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const activeMonthNames = activeMonthsData.map(m => m.month);
      const sortedMonths = activeMonthNames.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
      earliestMonth = sortedMonths[0];
      latestMonth = sortedMonths[sortedMonths.length - 1];
    }

    // Get sales tax data from the sales tax section
    let salesTaxData = [];
    if (salesTaxSectionRef.current) {
      try {
        salesTaxData = salesTaxSectionRef.current.getSalesTaxData();
      } catch (error) {
        console.log('Error getting sales tax data for popup:', error);
      }
    }

    // Get payroll data from the payroll section
    let payrollData = [];
    if (payrollSectionRef.current) {
      try {
        payrollData = payrollSectionRef.current.getPayrollData();
      } catch (error) {
        console.log('Error getting payroll data for popup:', error);
      }
    }

    return {
      isSimple: false,
      booksRate,
      salesTaxRate: salesTaxTotals.rate,
      payrollRate: payrollTotals.rate,
      totalSetupFees: payrollTotals.setup + salesTaxTotals.setup,
      totalMonthlyRate: booksRate + payrollTotals.rate + salesTaxTotals.rate,
      earliestMonth,
      latestMonth,
      accountDetails,
      salesTaxData,
      payrollData
    };
  };

  const generateCopyText = (data) => {
    // Handle annual data structure
    if (!isMonthly && data.totalAnnualRate !== undefined) {
      let text = `Quote:\nBooks - $${data.booksRate}\n`;
      
      data.accountDetails.forEach(account => {
        const getAccountAbbr = (type) => {
          if (!type) return 'CK';
          const lowerType = type.toLowerCase();
          if (lowerType.includes('checking')) return 'CK';
          if (lowerType.includes('savings')) return 'SA';
          if (lowerType.includes('credit')) return 'CC';
          return 'CK'; // default
        };
        const accountAbbr = getAccountAbbr(account.accountType);
        const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
        text += `• ${accountAbbr} ${account.lastFour || 'X'} - ${avgTransactions} t/m\n`;
      });

      text += `\Cost of Services Adjustment:\n• (provide details)\n`;
      text += `\nInternal Notes:\n• (provide details)\n`;
      
      text += `\nBilling: (Please delete any fields that are not relevant)\n`;
      text += `+ Total Quote Amount: $${data.totalAnnualRate}\n`;
      text += `- Annual Discount: $${data.annualDiscount} ${data.discountPercent > 0 ? `(${Math.round(data.discountPercent * 100)}%)` : ''}\n`;
      text += `- Amount Paid: $\n`;
      text += `= Total Amount Due Today: $${data.discountedRate}\n`;
      
      return text;
    }
    
    // Handle monthly data structure
    if (data.isSimple) return data.content;
    
    let text = `Quote:\nBooks - $${data.booksRate}\n`;
    
    if (data.earliestMonth) {
      text += `Starting Month: ${data.earliestMonth}\n`;
    }

    data.accountDetails.forEach(account => {
      const getAccountAbbr = (type) => {
        if (!type) return 'CK';
        const lowerType = type.toLowerCase();
        if (lowerType.includes('checking')) return 'CK';
        if (lowerType.includes('savings')) return 'SA';
        if (lowerType.includes('credit')) return 'CC';
        return 'CK'; // default
      };
      const accountAbbr = getAccountAbbr(account.accountType);
      const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
      text += `• ${accountAbbr} ${account.lastFour || 'X'} - ${avgTransactions} t/m\n`;
    });

    if (data.salesTaxRate > 0) {
      text += `\nSales Tax - $${data.salesTaxRate}\n`;
      text += `Starting Month:\n`;
      
      if (data.salesTaxData && data.salesTaxData.length > 0) {
        data.salesTaxData.forEach(salesTaxRow => {
          const abbr = stateAbbreviations[salesTaxRow.state] || salesTaxRow.state;
          for (let i = 0; i < salesTaxRow.certificates; i++) {
            text += `• ${abbr}, ${salesTaxRow.type}\n`;
          }
        });
      } else {
        text += `• STATE, Existing / New\n`;
      }
    }

    if (data.payrollRate > 0) {
      text += `\nPayroll - $${data.payrollRate}\n`;
      text += `Starting Month:\n`;
      
      if (data.payrollData && data.payrollData.length > 0) {
        data.payrollData.forEach(payrollRow => {
          const abbr = stateAbbreviations[payrollRow.state] || payrollRow.state;
          text += `• ${payrollRow.employees} Employees, ${abbr}, ${payrollRow.type} Account\n`;
        });
      } else {
        text += `• X Employees, STATE, Existing / New Account\n`;
      }
    }

    text += `\Cost of Services Adjustment:\n• (provide details)\n`;
    text += `\nInternal Notes:\n• (provide details)\n`;
    
    text += `\nBilling: (Please delete any fields that are not relevant)\n`;
    text += `+ Cost of Services Adjustment: $\n`;
    text += `• [Cost since start date]\n`;
    if (payrollTotals.setup > 0) {
      text += `+ Payroll Set Up: $${payrollTotals.setup}\n`;
    }
    if (salesTaxTotals.setup > 0) {
      text += `+ Sales Tax Set Up: $${salesTaxTotals.setup}\n`;
    }
    text += `- Discounts: $\n`;
    text += `= Total Amount Due Today: $\n`;
    
    text += `\nMonthly Rate - All Services: $${data.totalMonthlyRate}`;

    return text;
  };

  const generateRichCopyText = (data) => {
    // Handle annual data structure
    if (!isMonthly && data.totalAnnualRate !== undefined) {
      let html = `<div><strong>Quote:</strong><br/>`;
      html += `<u>Books</u> - $${data.booksRate}<br/>`;

      data.accountDetails.forEach((account, index) => {
        const getAccountAbbr = (type) => {
          if (!type) return 'CK';
          const lowerType = type.toLowerCase();
          if (lowerType.includes('checking')) return 'CK';
          if (lowerType.includes('savings')) return 'SA';
          if (lowerType.includes('credit')) return 'CC';
          return 'CK'; // default
        };
        const accountAbbr = getAccountAbbr(account.accountType);
        const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
        html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>${accountAbbr} ${account.lastFour || 'X'}</strong> - ${avgTransactions} t/m<br/>`;
      });

      html += `<br/><u><em>Cost of Services Adjustment:</em></u><br/>`;
      html += `&nbsp;&nbsp;&nbsp;&nbsp;• (provide details)<br/>`;
      
      html += `<br/><u><em>Internal Notes:</em></u><br/>`;
      html += `&nbsp;&nbsp;&nbsp;&nbsp;• (provide details)<br/>`;
      
      html += `<br/><u><em>Billing: (Please delete any fields that are not relevant)</em></u><br/>`;
      html += `+ Total Quote Amount: $${data.totalAnnualRate}<br/>`;
      html += `- Annual Discount: $${data.annualDiscount} ${data.discountPercent > 0 ? `(${Math.round(data.discountPercent * 100)}%)` : ''}<br/>`;
      html += `- Amount Paid: $<br/>`;
      html += `= <strong>Total Amount Due Today:</strong> $${data.discountedRate}<br/>`;
      
      return html;
    }
    
    // Handle monthly data structure
    if (data.isSimple) return data.content;
    
    let html = `<div><strong>Quote:</strong><br/>`;
    html += `<u>Books</u> - $${data.booksRate}<br/>`;
    
    if (data.earliestMonth) {
      html += `Starting Month: ${data.earliestMonth}<br/>`;
    }

    data.accountDetails.forEach((account, index) => {
      const getAccountAbbr = (type) => {
        if (!type) return 'CK';
        const lowerType = type.toLowerCase();
        if (lowerType.includes('checking')) return 'CK';
        if (lowerType.includes('savings')) return 'SA';
        if (lowerType.includes('credit')) return 'CC';
        return 'CK'; // default
      };
      const accountAbbr = getAccountAbbr(account.accountType);
      const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
      html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>${accountAbbr} ${account.lastFour || 'X'}</strong> - ${avgTransactions} t/m<br/>`;
    });

    if (data.salesTaxRate > 0) {
      html += `<br/><u>Sales Tax</u> - $${data.salesTaxRate}<br/>`;
      html += `Starting Month:<br/>`;
      
      if (data.salesTaxData && data.salesTaxData.length > 0) {
        data.salesTaxData.forEach(salesTaxRow => {
          const abbr = stateAbbreviations[salesTaxRow.state] || salesTaxRow.state;
          for (let i = 0; i < salesTaxRow.certificates; i++) {
            html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>${abbr}</strong>, ${salesTaxRow.type}<br/>`;
          }
        });
      } else {
        html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>STATE</strong>, Existing / New<br/>`;
      }
    }

    if (data.payrollRate > 0) {
      html += `<br/><u>Payroll</u> - $${data.payrollRate}<br/>`;
      html += `Starting Month:<br/>`;
      
      if (data.payrollData && data.payrollData.length > 0) {
        data.payrollData.forEach(payrollRow => {
          const abbr = stateAbbreviations[payrollRow.state] || payrollRow.state;
          html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>${payrollRow.employees} Employees</strong>, <strong>${abbr}</strong>, ${payrollRow.type} Account<br/>`;
        });
      } else {
        html += `&nbsp;&nbsp;&nbsp;&nbsp;• <strong>X Employees</strong>, <strong>STATE</strong>, Existing / New Account<br/>`;
      }
    }

    html += `<br/><u><em>Cost of Services Adjustment:</em></u><br/>`;
    html += `&nbsp;&nbsp;&nbsp;&nbsp;• (provide details)<br/>`;
    
    html += `<br/><u><em>Internal Notes:</em></u><br/>`;
    html += `&nbsp;&nbsp;&nbsp;&nbsp;• (provide details)<br/>`;
    
    html += `<br/><u><em>Billing: (Please delete any fields that are not relevant)</em></u><br/>`;
    html += `+ Cost of <em>Services Adjustment:</em> $<br/>`;
    html += `&nbsp;&nbsp;&nbsp;&nbsp;• [Cost since start date]<br/>`;
    if (payrollTotals.setup > 0) {
      html += `+ <em>Payroll Set Up:</em> $${payrollTotals.setup}<br/>`;
    }
    if (salesTaxTotals.setup > 0) {
      html += `+ <em>Sales Tax Set Up:</em> $${salesTaxTotals.setup}<br/>`;
    }
    html += `- <em>Discounts:</em> $<br/>`;
    html += `= <strong>Total Amount Due Today:</strong> $<br/>`;
    
    html += `<br/><em>Monthly Rate - All Services:</em> $${data.totalMonthlyRate}</div>`;

    return html;
  };

  const copyToClipboard = async () => {
    const data = isMonthly ? generatePopupData() : generateAnnualPopupData();
    const htmlText = generateRichCopyText(data);
    const plainText = generateCopyText(data);
    
    // Method 1: Try modern Clipboard API with permission request
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        // Request clipboard permission if needed
        if (navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'clipboard-write' });
          if (permission.state === 'denied') {
            throw new Error('Clipboard permission denied');
          }
        }
        
        // Try rich text copy first
        try {
          const clipboardData = new ClipboardItem({
            'text/html': new Blob([htmlText], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' })
          });
          
          await navigator.clipboard.write([clipboardData]);
          setShowCopyNotification(true);
          setTimeout(() => setShowCopyNotification(false), 3000);
          return;
        } catch (richTextError) {
          console.log('Rich text copy failed, trying plain text:', richTextError);
          // Fall back to plain text
          await navigator.clipboard.writeText(plainText);
          setShowCopyNotification(true);
          setTimeout(() => setShowCopyNotification(false), 3000);
          return;
        }
      } catch (clipboardError) {
        console.error('Clipboard API failed:', clipboardError);
        // Continue to fallback method
      }
    }
    
    // Method 2: Rich text fallback using contenteditable div
    try {
      // Create a temporary contenteditable div for rich text copying
      const tempDiv = document.createElement('div');
      tempDiv.contentEditable = true;
      tempDiv.innerHTML = htmlText;
      tempDiv.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
      `;
      
      document.body.appendChild(tempDiv);
      
      // Select the content
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Try to copy using execCommand
      const copySuccessful = document.queryCommandSupported('copy') 
        ? document.execCommand('copy')
        : false;
      
      // Clean up
      document.body.removeChild(tempDiv);
      selection.removeAllRanges();
      
      if (copySuccessful) {
        setShowCopyNotification(true);
        setTimeout(() => setShowCopyNotification(false), 3000);
        return;
      }
      
      // If rich text copy failed, try plain text as fallback
      const tempInput = document.createElement('input');
      tempInput.type = 'text';
      tempInput.value = plainText;
      tempInput.style.position = 'absolute';
      tempInput.style.left = '-9999px';
      tempInput.style.top = '-9999px';
      tempInput.style.opacity = '0';
      tempInput.setAttribute('readonly', '');
      
      document.body.appendChild(tempInput);
      tempInput.select();
      tempInput.setSelectionRange(0, tempInput.value.length);
      
      const plainCopySuccessful = document.queryCommandSupported('copy') 
        ? document.execCommand('copy')
        : false;
      
      document.body.removeChild(tempInput);
      
      if (plainCopySuccessful) {
        setShowCopyNotification(true);
        setTimeout(() => setShowCopyNotification(false), 3000);
        return;
      }
      
      // Final attempt with clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(plainText);
          setShowCopyNotification(true);
          setTimeout(() => setShowCopyNotification(false), 3000);
          return;
        } catch (finalError) {
          console.error('Final clipboard attempt failed:', finalError);
        }
      }
      
    } catch (fallbackError) {
      console.error('Fallback method failed:', fallbackError);
    }
    
    // Method 3: Create a visible rich text editor for manual copy
    try {
      // Create a modal-like rich text editor that user can manually copy from
      const modalOverlay = document.createElement('div');
      modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 80%;
        max-height: 80%;
        overflow: auto;
        position: relative;
      `;
      
      const closeButton = document.createElement('button');
      closeButton.textContent = '×';
      closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
      `;
      
      // Create rich text editor
      const richTextEditor = document.createElement('div');
      richTextEditor.contentEditable = true;
      richTextEditor.innerHTML = htmlText;
      richTextEditor.style.cssText = `
        width: 100%;
        min-height: 300px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        overflow-y: auto;
        background: white;
        outline: none;
      `;
      
      // Create plain text area as backup
      const textArea = document.createElement('textarea');
      textArea.value = plainText;
      textArea.style.cssText = `
        width: 100%;
        min-height: 200px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        resize: vertical;
        margin-top: 10px;
        display: none;
      `;
      
      const instructions = document.createElement('p');
      instructions.innerHTML = `
        <strong>Rich Text Copy:</strong> Select all text above (Ctrl+A) and copy it (Ctrl+C) to preserve formatting.<br>
        <strong>Plain Text Copy:</strong> <a href="#" style="color: #007bff; text-decoration: underline;">Click here</a> to show plain text version.
      `;
      instructions.style.cssText = `
        margin: 10px 0;
        color: #666;
        font-size: 14px;
      `;
      
      // Toggle between rich text and plain text
      const toggleLink = instructions.querySelector('a');
      toggleLink.onclick = (e) => {
        e.preventDefault();
        if (textArea.style.display === 'none') {
          textArea.style.display = 'block';
          richTextEditor.style.display = 'none';
          toggleLink.textContent = 'Click here to show rich text version';
          textArea.focus();
          textArea.select();
        } else {
          textArea.style.display = 'none';
          richTextEditor.style.display = 'block';
          toggleLink.textContent = 'Click here to show plain text version';
          richTextEditor.focus();
          const range = document.createRange();
          range.selectNodeContents(richTextEditor);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      };
      
      closeButton.onclick = () => {
        document.body.removeChild(modalOverlay);
      };
      
      modalContent.appendChild(closeButton);
      modalContent.appendChild(instructions);
      modalContent.appendChild(richTextEditor);
      modalContent.appendChild(textArea);
      modalOverlay.appendChild(modalContent);
      document.body.appendChild(modalOverlay);
      
      // Focus and select the rich text content
      richTextEditor.focus();
      const range = document.createRange();
      range.selectNodeContents(richTextEditor);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      
      return;
      
    } catch (modalError) {
      console.error('Modal fallback failed:', modalError);
      
      // Final fallback: simple alert
      alert('Copy failed. Here is the text to copy manually:\n\n' + plainText);
    }
  };

  // Generate PDF export
  const generateQuotePDF = () => {
    try {
      console.log('Starting PDF generation...');
      const doc = new jsPDF('landscape'); // Set to landscape orientation
      
      // Test if autoTable is available
      if (typeof autoTable !== 'function') {
        console.error('autoTable function not available');
        alert('PDF generation error: autoTable not imported properly');
        return;
      }
      
      const today = new Date();
      const formattedDate = formatDate(today);
      const companyName = getCompanyName();
      const frequency = isMonthly ? 'Monthly' : 'Annual';
      
      // Get current data for PDF
      const booksRate = booksTotals.rate;
      
      // PDF Title
      const title = `${frequency} Services Quote - ${companyName} - ${formattedDate}`;
      
          // Add logo (top right) with proper aspect ratio
      const logoUrl = 'https://static.wixstatic.com/media/e1c7e1_68f82a3b1d36432581fdd8b7a4566a10~mv2.png';
      try {
        // Add logo with proper aspect ratio - moved higher and stretched horizontally by 15%
        // Original size was 36x12, now 41.4x12 (36 * 1.15 = 41.4)
        doc.addImage(logoUrl, 'PNG', 250, 5, 41.4, 12);
      } catch (logoError) {
        console.log('Logo loading failed, continuing without logo');
      }
      
      // Add date at top left
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal'); // Helvetica as Open Sans equivalent for body text
      doc.setTextColor(136, 125, 113); // Brand dark extra color for subtle date
      doc.text(formattedDate, 20, 15);
      
      // Add company name, employee name, and owner name in line with the date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal'); // Helvetica as Open Sans equivalent for body text
      doc.setTextColor(136, 125, 113); // Brand dark extra color for subtle text
      
      // Owner name (left side)
      const formData = quoteFormRef.current?.getFormData?.();
      const ownerName = formData?.ownerName || '';
      if (ownerName) {
        doc.text(ownerName, 20, 25);
      }
      
      // Company name (center) - larger font with yellow highlighting
      doc.setFontSize(14); // Larger font
      doc.setFont('helvetica', 'bold'); // Bold font
      doc.setTextColor(255, 193, 7); // Yellow color (#ffc107)
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const textWidth = doc.getTextWidth(companyName);
      const centerX = (pageWidth - textWidth) / 2;
      doc.text(companyName, centerX, 25);
      
      // Employee name (right side) with "Employee:" and name in box
      const employeeName = getEmployeeName();
      if (employeeName) {
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Create combined text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Black text
        const labelText = 'Employee:';
        const labelWidth = doc.getTextWidth(labelText);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(136, 125, 113); // Subtle color for the name
        const nameWidth = doc.getTextWidth(employeeName);
        
        // Calculate position for the entire employee section
        const totalWidth = labelWidth + 2 + nameWidth; // 2px spacing between label and name
        const rightX = pageWidth - totalWidth - 20; // 20px margin from right edge
        
        // Draw box around entire employee section
        const boxPadding = 4;
        const boxHeight = 8;
        doc.setDrawColor(0, 0, 0); // Black border
        doc.setLineWidth(0.5);
        doc.rect(rightX - boxPadding, 25 - boxHeight/2, totalWidth + boxPadding*2, boxHeight);
        
        // Draw the label text
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0); // Black text
        doc.text(labelText, rightX, 25);
        
        // Draw the employee name
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(136, 125, 113); // Subtle color for the name
        doc.text(employeeName, rightX + labelWidth + 2, 25); // 2px spacing after label
      }
      
      // Add main title
      doc.setFontSize(20);
      doc.setFont('times', 'bold'); // Times as closest equivalent to Libre Baskerville for headings
      doc.setTextColor(71, 56, 39); // Brand dark color for title
      doc.text('Monthly Services Quote', 20, 40);
      
      if (!isMonthly) {
        doc.text(`Year: ${selectedYear}`, 20, 65);
      }
      
      let yPosition = 80;
    
    // Brand colors (from variables.css)
    const brandColors = {
      dark: [71, 56, 39],      // #473827
      main: [188, 178, 161],   // #bcb2a1  
      darkExtra: [136, 125, 113], // #887d71
      white: [255, 255, 255]   // #fff
    };
    
    if (isMonthly) {
      // Fixed position for top tables - below logo
      const topTableY = 50; // Fixed position below logo (adjusted for new title position)
      
      // Monthly Services Breakdown (centered)
      doc.setFontSize(12);
      doc.setFont('times', 'bold'); // Times for section headings (Libre Baskerville equivalent)
      
      // Center both tables on the page
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = 65; // Width of each table
      const gapBetweenTables = 20; // Reduced gap between tables
      const totalWidth = tableWidth * 2 + gapBetweenTables;
      const leftTableX = (pageWidth - totalWidth) / 2;
      const rightTableX = leftTableX + tableWidth + gapBetweenTables;
      
      doc.text('Monthly Services Breakdown', leftTableX, topTableY);
      doc.text('Set Up Fees', rightTableX, topTableY);
      
      // Monthly breakdown table (left side) - more compact
      const monthlyData = [
        ['Books', `$${booksRate}`],
        ['Payroll', payrollTotals.rate ? `$${payrollTotals.rate}` : '$0'],
        ['Sales Tax', salesTaxTotals.rate ? `$${salesTaxTotals.rate}` : '$0'],
        ['Monthly Rate', `$${booksRate + payrollTotals.rate + salesTaxTotals.rate}`]
      ];
      
      autoTable(doc, {
        startY: topTableY + 3, // Reduced spacing from 5 to 3
        head: [['Services', 'Rates']],
        body: monthlyData,
        margin: { left: leftTableX },
        tableWidth: 65, // Constrain table width (reduced from 80)
        styles: { 
          fontSize: 8, // Reduced from 9
          cellPadding: 2, // Reduced from 3
          lineHeight: 1.1, // Reduced from 1.2
          lineColor: [230, 225, 215], // Light brand-themed borders
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [188, 178, 161], // Brand main color for headers
          textColor: [255, 255, 255], // White text for contrast
          fontStyle: 'bold',
          fontSize: 8 // Reduced from 9
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // Clean white background
          textColor: [71, 56, 39] // Brand dark color for text
        },
        alternateRowStyles: {
          fillColor: [250, 248, 245] // Very light version of brand main
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Services column (reduced from 50)
          1: { cellWidth: 25 }  // Rates column (reduced from 30)
        },
        didParseCell: function (data) {
          // Brand-themed styling for the total row
          if (data.row.index === monthlyData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [136, 125, 113]; // Brand dark extra color
            data.cell.styles.textColor = [255, 255, 255]; // White text for contrast
            data.cell.styles.lineWidth = 0.2;
            data.cell.styles.lineColor = [71, 56, 39]; // Brand dark border
          }
        }
      });
      
      // Setup fees table (right side) - positioned beside monthly breakdown
      const setupData = [
        ['Payroll Registration', payrollTotals.setup ? `$${payrollTotals.setup}` : '$0'],
        ['Resale Certificate Set Up', salesTaxTotals.setup ? `$${salesTaxTotals.setup}` : '$0'],
        ['Total Set Up Fees', `$${payrollTotals.setup + salesTaxTotals.setup}`]
      ];
      
      autoTable(doc, {
        startY: topTableY + 3, // Reduced spacing from 5 to 3
        head: [['Service', 'Set Up Fee']],
        body: setupData,
        margin: { left: rightTableX }, // Position to the right
        tableWidth: 65, // Constrain table width (reduced from 80)
        styles: { 
          fontSize: 8, // Reduced from 9
          cellPadding: 2, // Reduced from 3
          lineHeight: 1.1, // Reduced from 1.2
          lineColor: [230, 225, 215], // Light brand-themed borders
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [188, 178, 161], // Brand main color for headers
          textColor: [255, 255, 255], // White text for contrast
          fontStyle: 'bold',
          fontSize: 8 // Reduced from 9
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // Clean white background
          textColor: [71, 56, 39] // Brand dark color for text
        },
        alternateRowStyles: {
          fillColor: [250, 248, 245] // Very light version of brand main
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Service column (reduced from 50)
          1: { cellWidth: 25 }  // Setup Fee column (reduced from 30)
        },
        didParseCell: function (data) {
          // Brand-themed styling for the total row
          if (data.row.index === setupData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [136, 125, 113]; // Brand dark extra color
            data.cell.styles.textColor = [255, 255, 255]; // White text for contrast
            data.cell.styles.lineWidth = 0.2;
            data.cell.styles.lineColor = [71, 56, 39]; // Brand dark border
          }
        }
      });
      
      // Fixed position for Bookkeeping Breakdown - below top tables (increased spacing)
      yPosition = 100; // Fixed position below top tables (increased spacing between rate tables and bookkeeping table)
      
      // Add detailed account breakdown tables for monthly quotes
      if (booksSectionRef.current) {
        try {
          const detailedAccountsData = booksSectionRef.current.getDetailedAccountData();
          
          if (detailedAccountsData && detailedAccountsData.length > 0) {
            // Removed "Bookkeeping Breakdown" title - table will start directly at yPosition
            
            // Create a single consolidated table with all accounts - matching your example format
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            // Create table headers to match your example exactly
            const tableHeaders = ['Account', 'Type', 'Last 4', 'Monthly Rate', 'Average Transactions'].concat(months);
            
            // Helper function to abbreviate account types
            const getAccountTypeAbbr = (type) => {
              if (!type) return 'Checking';
              const lowerType = type.toLowerCase();
              if (lowerType.includes('checking')) return 'Checking';
              if (lowerType.includes('savings')) return 'Savings';
              if (lowerType.includes('credit')) return 'Credit Card';
              return 'Checking'; // default
            };
            
            // Create rows for each account
            const accountRows = detailedAccountsData.map((account) => {
              // Add "NEW" to Average Transactions if it's a new account
              const avgTransactions = account.averages ? account.averages.total.toString() : '0';
              const avgTransactionsWithNew = account.isNewAccount ? `${avgTransactions} NEW` : avgTransactions;
              
              const accountRow = [
                account.bankName,
                getAccountTypeAbbr(account.accountType),
                account.lastFour,
                `$${account.monthlyRate || '0'}`,
                avgTransactionsWithNew
              ];
              
              // Add monthly transaction data
              months.forEach(month => {
                const fullMonthName = month === 'Jan' ? 'January' :
                                   month === 'Feb' ? 'February' :
                                   month === 'Mar' ? 'March' :
                                   month === 'Apr' ? 'April' :
                                   month === 'May' ? 'May' :
                                   month === 'Jun' ? 'June' :
                                   month === 'Jul' ? 'July' :
                                   month === 'Aug' ? 'August' :
                                   month === 'Sep' ? 'September' :
                                   month === 'Oct' ? 'October' :
                                   month === 'Nov' ? 'November' : 'December';
                
                const monthData = account.monthlyTransactions[fullMonthName];
                if (monthData && monthData.total !== undefined) {
                  accountRow.push(monthData.total.toString());
                } else {
                  accountRow.push('N/A');
                }
              });
              
              return accountRow;
            });
            
            // Calculate total table width to center it properly
            const columnWidths = [30, 20, 12, 15, 20, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]; // Account, Type, Last4, Monthly Rate, Average Transactions, 12 months
            const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
            const pageWidthForTable = doc.internal.pageSize.getWidth();
            const leftMargin = (pageWidthForTable - totalTableWidth) / 2;
            
            // Create the consolidated table matching your example
            autoTable(doc, {
              startY: yPosition,
              head: [tableHeaders],
              body: accountRows,
              margin: { left: leftMargin, right: leftMargin },
              styles: { 
                fontSize: 6,
                cellPadding: 2,
                lineHeight: 1.1,
                halign: 'center',
                lineColor: [230, 225, 215], // Light brand-themed borders
                lineWidth: 0.1
              },
              headStyles: {
                fillColor: [188, 178, 161], // Brand main color header
                textColor: [255, 255, 255], // White text for contrast
                fontStyle: 'bold',
                fontSize: 6
              },
              bodyStyles: {
                fillColor: [255, 255, 255], // White background
                textColor: [71, 56, 39] // Brand dark color for text
              },
              alternateRowStyles: {
                fillColor: [250, 248, 245] // Very light version of brand main
              },
              columnStyles: {
                0: { cellWidth: 30, halign: 'left' }, // Account - left aligned
                1: { cellWidth: 20, halign: 'left' }, // Type - left aligned  
                2: { cellWidth: 12, halign: 'center' }, // Last 4 - centered
                3: { cellWidth: 15, halign: 'center' }, // Monthly Rate - centered
                4: { cellWidth: 20, halign: 'center' }, // Average Transactions - centered
                5: { cellWidth: 8, halign: 'center' }, // Jan
                6: { cellWidth: 8, halign: 'center' }, // Feb
                7: { cellWidth: 8, halign: 'center' }, // Mar
                8: { cellWidth: 8, halign: 'center' }, // Apr
                9: { cellWidth: 8, halign: 'center' }, // May
                10: { cellWidth: 8, halign: 'center' }, // Jun
                11: { cellWidth: 8, halign: 'center' }, // Jul
                12: { cellWidth: 8, halign: 'center' }, // Aug
                13: { cellWidth: 8, halign: 'center' }, // Sep
                14: { cellWidth: 8, halign: 'center' }, // Oct
                15: { cellWidth: 8, halign: 'center' }, // Nov
                16: { cellWidth: 8, halign: 'center' } // Dec
              }
            });
            
            // Removed old "NEW" marker code - now using "NEW" text in Average Transactions column
            
            yPosition = doc.lastAutoTable ? doc.lastAutoTable.finalY + 5 : yPosition + 30; // Reduced spacing
          }
        } catch (error) {
          console.log('Error getting detailed account data for PDF:', error);
        }
      }
      
      // Add combined Payroll and Sales Tax Breakdown (bottom center) - fixed position
      const bottomTableY = 135; // Fixed position for bottom tables (adjusted for new layout)
      
      // Get payroll and sales tax data
      let payrollData = [];
      let salesTaxData = [];
      
      if (payrollSectionRef.current) {
        try {
          payrollData = payrollSectionRef.current.getPayrollData();
        } catch (error) {
          console.log('Error getting payroll data for PDF:', error);
        }
      }
      
      if (salesTaxSectionRef.current) {
        try {
          salesTaxData = salesTaxSectionRef.current.getSalesTaxData();
        } catch (error) {
          console.log('Error getting sales tax data for PDF:', error);
        }
      }
      
      // Only create table if we have data
      if (payrollData.length > 0 || salesTaxData.length > 0) {
        doc.setFontSize(12);
        doc.setFont('times', 'bold');
        
        // Center the title
        const pageWidth = doc.internal.pageSize.getWidth();
        const titleText = 'Payroll & Sales Tax Breakdown';
        const titleWidth = doc.getTextWidth(titleText);
        const titleX = (pageWidth - titleWidth) / 2;
        doc.text(titleText, titleX, bottomTableY);
        
        // Create combined table data
        const combinedTableData = [];
        
        // Add payroll data
        payrollData.forEach(row => {
          combinedTableData.push([
            'Payroll',
            row.state,
            row.employees.toString(),
            row.type,
            `$${calculatePayrollRate(row.employees)}`,
            `$${calculatePayrollSetup(row.type)}`
          ]);
        });
        
        // Add sales tax data
        salesTaxData.forEach(row => {
          combinedTableData.push([
            'Sales Tax',
            row.state,
            row.certificates.toString(),
            row.type,
            `$${calculateSalesTaxRates([row.certificates])[0]}`,
            `$${calculateSalesTaxSetup(row.type, row.certificates)}`
          ]);
        });
        
        // Calculate table width and center it properly
        const columnWidths = [25, 30, 20, 35, 25, 25]; // Service, State, Count, New or Existing, Rate, Set up fee
        const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
        const leftMargin = (pageWidth - tableWidth) / 2;
        
        autoTable(doc, {
          startY: bottomTableY + 3,
          head: [['Service', 'State', 'Count', 'New or Existing', 'Rate', 'Set up fee']],
          body: combinedTableData,
          margin: { left: leftMargin, right: leftMargin },
          tableWidth: tableWidth,
          styles: { 
            fontSize: 8,
            cellPadding: 2,
            lineHeight: 1.1,
            lineColor: [0, 0, 0], // Black borders
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [188, 178, 161], // Brand main color for headers
            textColor: [255, 255, 255], // White text for contrast
            fontStyle: 'bold',
            fontSize: 8
          },
          bodyStyles: {
            fillColor: [255, 255, 255], // Clean white background
            textColor: [71, 56, 39] // Brand dark color for text
          },
          columnStyles: {
            0: { cellWidth: 25 }, // Service column
            1: { cellWidth: 30 }, // State column
            2: { cellWidth: 20 }, // Count column
            3: { cellWidth: 35 }, // New or Existing column
            4: { cellWidth: 25 }, // Rate column
            5: { cellWidth: 25 }  // Set up fee column
          },
          didParseCell: function (data) {
            // Apply different background colors for Payroll vs Sales Tax rows
            if (data.row.index > 0) { // Skip header row
              const serviceType = data.row.raw[0]; // Get the service type from first column
              if (serviceType === 'Payroll') {
                data.cell.styles.fillColor = [240, 248, 255]; // Soft blue (#f0f8ff - AliceBlue)
              } else if (serviceType === 'Sales Tax') {
                data.cell.styles.fillColor = [255, 248, 240]; // Soft orange (#fff8f0 - Seashell)
              }
            }
          }
        });
      }
      
    } else {
      // Annual quote tables
      const activeMonths = getActiveMonthsData();
      const pricingData = getAnnualPricingData();
      
      doc.setFontSize(12);
      doc.setFont('times', 'bold'); // Times for section headings (Libre Baskerville equivalent)
      doc.text('Annual Breakdown', 20, yPosition);
      doc.text('Pricing Breakdown', 110, yPosition);
      yPosition += 10;
      
      // Annual breakdown table (left side) - side by side with pricing breakdown
      const annualData = activeMonths.map(month => [month.month, `$${month.rate}`]);
      annualData.push(['Total Annual Rate', `$${pricingData.totalAnnualRate}`]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Month', 'Rates']],
        body: annualData,
        margin: { left: 20 },
        tableWidth: 80, // Constrain table width for side-by-side layout
        styles: { 
          fontSize: 8, // Decreased by 20% (from 10 to 8)
          cellPadding: 1.5, // Decreased by 50% (from 3 to 1.5)
          lineHeight: 1.1,
          lineColor: [230, 225, 215], // Light brand-themed borders
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [188, 178, 161], // Brand main color for headers
          textColor: [255, 255, 255], // White text for contrast
          fontStyle: 'bold'
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // Clean white background
          textColor: [71, 56, 39] // Brand dark color for text
        },
        alternateRowStyles: {
          fillColor: [250, 248, 245] // Very light version of brand main
        },
        didParseCell: function (data) {
          // Brand-themed styling for the total row
          if (data.row.index === annualData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [136, 125, 113]; // Brand dark extra color
            data.cell.styles.textColor = [255, 255, 255]; // White text for contrast
            data.cell.styles.lineWidth = 0.2;
            data.cell.styles.lineColor = [71, 56, 39]; // Brand dark border
          }
        }
      });
      
      // Store the annual breakdown table final Y position
      const annualBreakdownFinalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yPosition + 60;
      
      // Pricing breakdown table (right side) - positioned beside annual breakdown
      const discountText = pricingData.discountPercentage > 0 
        ? `Annual Discount (${Math.round(pricingData.discountPercentage * 100)}%)`
        : 'Annual Discount';
      
      const pricingTableData = [
        ['Total Annual Rate', `$${pricingData.totalAnnualRate}`],
        [discountText, `-$${pricingData.discountAmount}`],
        ['Discounted Rate', `$${pricingData.discountedRate}`]
      ];
      
      autoTable(doc, {
        startY: yPosition,
        body: pricingTableData,
        margin: { left: 110 }, // Position to the right
        tableWidth: 80, // Constrain table width
        styles: { 
          fontSize: 10,
          cellPadding: 3,
          lineHeight: 1.2,
          lineColor: [230, 225, 215], // Light brand-themed borders
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [188, 178, 161], // Brand main color for headers
          textColor: [255, 255, 255], // White text for contrast
          fontStyle: 'bold'
        },
        bodyStyles: {
          fillColor: [255, 255, 255], // Clean white background
          textColor: [71, 56, 39] // Brand dark color for text
        },
        alternateRowStyles: {
          fillColor: [250, 248, 245] // Very light version of brand main
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          // Brand-themed styling for the final discounted rate row
          if (data.row.index === pricingTableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [136, 125, 113]; // Brand dark extra color
            data.cell.styles.textColor = [255, 255, 255]; // White text for contrast
            data.cell.styles.lineWidth = 0.2;
            data.cell.styles.lineColor = [71, 56, 39]; // Brand dark border
          }
        }
      });
      
      // Get the pricing breakdown table final Y position
      const pricingBreakdownFinalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yPosition + 60;
      
      // Position Account Details under whichever table is taller
      yPosition = Math.max(annualBreakdownFinalY, pricingBreakdownFinalY) + 25;
      
              // Add account details for annual quotes as well
        if (booksSectionRef.current) {
          try {
            const detailedAccountsData = booksSectionRef.current.getDetailedAccountData();
            
          if (detailedAccountsData && detailedAccountsData.length > 0) {
            doc.setFontSize(12);
            doc.setFont('times', 'bold'); // Times for section headings (Libre Baskerville equivalent)
            // Center the "Account Details" title
            const pageWidth = doc.internal.pageSize.getWidth();
            const textWidth = doc.getTextWidth('Account Details');
            const centerX = (pageWidth - textWidth) / 2;
            doc.text('Account Details', centerX, yPosition);
            yPosition += 12;
            
            // Create a single consolidated table with all accounts for annual - matching your example format
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            // Create table headers to match your example exactly
            const tableHeaders = ['Account', 'Type', 'Last 4', 'Annual Rate'].concat(months);
            
            // Helper function to abbreviate account types
            const getAccountTypeAbbr = (type) => {
              if (!type) return 'Checking';
              const lowerType = type.toLowerCase();
              if (lowerType.includes('checking')) return 'Checking';
              if (lowerType.includes('savings')) return 'Savings';
              if (lowerType.includes('credit')) return 'Credit Card';
              return 'Checking'; // default
            };
            
            // Create rows for each account
            const accountRows = detailedAccountsData.map((account) => {
              const accountRow = [
                account.bankName,
                getAccountTypeAbbr(account.accountType),
                account.lastFour,
                `$${account.monthlyRate || '0'}`
              ];
              
              // Add monthly transaction data
              months.forEach(month => {
                const fullMonthName = month === 'Jan' ? 'January' :
                                   month === 'Feb' ? 'February' :
                                   month === 'Mar' ? 'March' :
                                   month === 'Apr' ? 'April' :
                                   month === 'May' ? 'May' :
                                   month === 'Jun' ? 'June' :
                                   month === 'Jul' ? 'July' :
                                   month === 'Aug' ? 'August' :
                                   month === 'Sep' ? 'September' :
                                   month === 'Oct' ? 'October' :
                                   month === 'Nov' ? 'November' : 'December';
                
                const monthData = account.monthlyTransactions[fullMonthName];
                if (monthData && monthData.total !== undefined) {
                  accountRow.push(monthData.total.toString());
                } else {
                  accountRow.push('N/A');
                }
              });
              
              return accountRow;
            });
            
            // Calculate total table width to center it properly
            const columnWidths = [30, 20, 12, 15, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]; // Account, Type, Last4, Annual Rate, 12 months
            const totalTableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
            const annualPageWidth = doc.internal.pageSize.getWidth();
            const leftMargin = (annualPageWidth - totalTableWidth) / 2;
            
            // Create the consolidated table matching your example
            autoTable(doc, {
              startY: yPosition,
              head: [tableHeaders],
              body: accountRows,
              margin: { left: leftMargin, right: leftMargin },
              styles: { 
                fontSize: 6,
                cellPadding: 2,
                lineHeight: 1.1,
                halign: 'center',
                lineColor: [230, 225, 215], // Light brand-themed borders
                lineWidth: 0.1
              },
              headStyles: {
                fillColor: [188, 178, 161], // Brand main color header
                textColor: [255, 255, 255], // White text for contrast
                fontStyle: 'bold',
                fontSize: 6
              },
              bodyStyles: {
                fillColor: [255, 255, 255], // White background
                textColor: [71, 56, 39] // Brand dark color for text
              },
              alternateRowStyles: {
                fillColor: [250, 248, 245] // Very light version of brand main
              },
              columnStyles: {
                0: { cellWidth: 30, halign: 'left' }, // Account - left aligned
                1: { cellWidth: 20, halign: 'left' }, // Type - left aligned  
                2: { cellWidth: 12, halign: 'center' }, // Last 4 - centered
                3: { cellWidth: 15, halign: 'center' }, // Monthly Rate - centered
                4: { cellWidth: 8, halign: 'center' }, // Jan
                5: { cellWidth: 8, halign: 'center' }, // Feb
                6: { cellWidth: 8, halign: 'center' }, // Mar
                7: { cellWidth: 8, halign: 'center' }, // Apr
                8: { cellWidth: 8, halign: 'center' }, // May
                9: { cellWidth: 8, halign: 'center' }, // Jun
                10: { cellWidth: 8, halign: 'center' }, // Jul
                11: { cellWidth: 8, halign: 'center' }, // Aug
                12: { cellWidth: 8, halign: 'center' }, // Sep
                13: { cellWidth: 8, halign: 'center' }, // Oct
                14: { cellWidth: 8, halign: 'center' }, // Nov
                15: { cellWidth: 8, halign: 'center' } // Dec
              }
            });
            
            yPosition = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : yPosition + 50;
          }
        } catch (error) {
          console.log('Error getting detailed account data for PDF:', error);
        }
      }
    }
    
      // Save the PDF
      doc.save(title + '.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Handle export quote button click
  const handleExportQuoteClick = () => {
    if (!quoteGenerated) {
      // Should not be clickable, but just in case
      return;
    }
    
    // Generate and download PDF
    generateQuotePDF();
    
    // Show popup
    setShowExportPopup(true);
  };

  const generateAnnualPopupData = () => {
    // Get all necessary data
    const formData = quoteFormRef.current?.getFormData?.();
    // Get account details
    let accountDetails = [];
    if (booksSectionRef.current) {
      try {
        const detailedAccountsData = booksSectionRef.current.getDetailedAccountData();
        accountDetails = detailedAccountsData || [];
      } catch (error) {
        console.log('Error getting account details for annual popup:', error);
      }
    }
    // Get annual pricing data
    const pricingData = getAnnualPricingData();
    return {
      booksRate: booksTotals.rate,
      accountDetails,
      totalAnnualRate: pricingData.totalAnnualRate,
      annualDiscount: pricingData.discountAmount,
      discountedRate: pricingData.discountedRate,
      discountPercent: pricingData.discountPercentage,
    };
  };

  return (
    <>
      <div className="dashboard-section">
        <h2 className="dashboard-title">Dashboard</h2>
        <div className="dashboard-content">
          <div className="dashboard-left">
            <div className="generate-quote-block bordered-block">
              <div className={`toggle-slider${!isMonthly ? ' annual' : ''}`} role="group" aria-label="Billing Frequency">
                <div className="slider-bg" />
                <button
                  className={`toggle-btn${isMonthly ? ' active' : ''}`}
                  id="monthly-btn"
                  type="button"
                  onClick={() => handleFrequencySwitch('monthly')}
                  disabled={isAnimating}
                >
                  Monthly
                </button>
                <button
                  className={`toggle-btn${!isMonthly ? ' active' : ''}`}
                  id="annual-btn"
                  type="button"
                  onClick={() => handleFrequencySwitch('annual')}
                  disabled={isAnimating}
                >
                  Annual
                </button>
              </div>
              {!isMonthly && (
                <div className="year-selector-container">
                  <label htmlFor="dashboard-year-selector" className="year-selector-label">
                    Select Year:
                  </label>
                  <select
                    id="dashboard-year-selector"
                    className={`year-selector${!selectedYear ? ' error' : ''}`}
                    value={selectedYear}
                    onChange={e => handleYearChange(e.target.value)}
                  >
                    <option value="">Select Year</option>
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>
              )}
              <label className="services-label">Select Services…</label>
              <div className="services-container" style={{ position: 'relative' }}>
                <div className="services-segmented">
                  {serviceList.map((service, idx) => {
                    const isDisabled = service.key === 'books' || 
                                     (!isMonthly && (service.key === 'payroll' || service.key === 'salesTax'));
                    return (
                      <button
                        key={service.key}
                        className={`service-btn${selectedServices.includes(service.key) ? ' selected' : ''}${isDisabled ? ' disabled' : ''}`}
                        type="button"
                        onClick={() => toggleService(service.key)}
                        disabled={isDisabled}
                        data-service-key={service.key}
                      >
                        {service.label}
                      </button>
                    );
                  })}
                </div>
                {confirmRemoveService && (
                  <div className="remove-confirm-tooltip service-remove-tooltip">
                    <div>Are you sure you want to remove {serviceList.find(s => s.key === confirmRemoveService)?.label}? All information in this section will be deleted.</div>
                    <div className="remove-confirm-actions">
                      <button 
                        className="cancel-btn" 
                        type="button" 
                        onClick={() => setConfirmRemoveService(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="delete-btn" 
                        type="button" 
                        onClick={() => confirmServiceRemoval(confirmRemoveService)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                {confirmAnnualSwitch && (
                  <div className="remove-confirm-tooltip service-remove-tooltip annual-switch-tooltip">
                    <div>
                      Switching to Annual mode will remove {confirmAnnualSwitch.map(service => 
                        serviceList.find(s => s.key === service)?.label
                      ).join(' and ')} services. All information in {confirmAnnualSwitch.length > 1 ? 'these sections' : 'this section'} will be deleted.
                    </div>
                    <div className="remove-confirm-actions">
                      <button 
                        className="cancel-btn" 
                        type="button" 
                        onClick={() => setConfirmAnnualSwitch(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="delete-btn" 
                        type="button" 
                        onClick={confirmAnnualSwitchAction}
                      >
                        Switch to Annual
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="dashboard-divider"></div>
              <button
                className={`generate-btn export-btn${(!validationState || quoteGenerated) ? ' disabled' : ''}`}
                type="button"
                aria-disabled={!validationState || quoteGenerated}
                tabIndex={0}
                onClick={e => {
                  e.preventDefault();
                  handleGenerateQuoteClick();
                }}
                style={{ opacity: validationState && !quoteGenerated ? 1 : 0.5, cursor: validationState && !quoteGenerated ? 'pointer' : 'not-allowed' }}
              >
                Generate quote
              </button>
              <button 
                className={`export-btn${!quoteGenerated ? ' disabled' : ''}`}
                type="button"
                onClick={handleExportQuoteClick}
                disabled={!quoteGenerated}
                style={{ opacity: quoteGenerated ? 1 : 0.5, cursor: quoteGenerated ? 'pointer' : 'not-allowed' }}
              >
                Export Quote
              </button>
            </div>
          </div>
          <div className="dashboard-right">
            <div className={`dashboard-tables dashboard-tables-${animationPhase}`}>
              {isMonthly ? (
                // MONTHLY TABLES
                <>
                  {/* Table 1: Monthly Breakdown */}
                  <div className="dashboard-table">
                    <div className="table-title"><b>Monthly Breakdown</b></div>
                    <div className={quoteGenerated ? '' : 'blurred'}>
                      <div className="table-row">
                        <span className="table-subtitle"><b>Services</b></span>
                        <span className="table-header">Rates</span>
                      </div>
                      <div className="table-row"><span>Books</span><span>{`$${booksRate}`}</span></div>
                      <div className="table-row"><span>Payroll</span><span>{payrollTotals.rate ? `$${payrollTotals.rate}` : '$0'}</span></div>
                      <div className="table-row"><span>Sales Tax</span><span>{salesTaxTotals.rate ? `$${salesTaxTotals.rate}` : '$0'}</span></div>
                      <div className="table-row table-total">
                        <span><b>Monthly Rate</b></span>
                        <span><b>{`$${booksRate + payrollTotals.rate + salesTaxTotals.rate}`}</b></span>
                      </div>
                    </div>
                  </div>
                  {/* Table 2: Setup Fees */}
                  <div className="dashboard-table">
                    <div className="table-title"><b>Setup fees</b></div>
                    <div className={quoteGenerated ? '' : 'blurred'}>
                      <div className="table-row">
                        <span className="table-subtitle"><b>Service</b></span>
                        <span className="table-header">Setup Fee</span>
                      </div>
                      <div className="table-row"><span>Payroll Registration</span><span>{payrollTotals.setup ? `$${payrollTotals.setup}` : '$0'}</span></div>
                      <div className="table-row"><span>Resale Certificate Set Up</span><span>{salesTaxTotals.setup ? `$${salesTaxTotals.setup}` : '$0'}</span></div>
                      <div className="table-row table-total">
                        <span><b>Total Setup Fee</b></span>
                        <span><b>{`$${payrollTotals.setup + salesTaxTotals.setup}`}</b></span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // ANNUAL TABLES
                <>
                  {/* Table 1: Annual Breakdown */}
                  <div className="dashboard-table">
                    <div className="table-title"><b>Annual Breakdown</b></div>
                    <div className={quoteGenerated ? '' : 'blurred'}>
                      <div className="table-row">
                        <span className="table-subtitle"><b>Month</b></span>
                        <span className="table-header">Rates</span>
                      </div>
                      {(() => {
                        const activeMonths = getActiveMonthsData();
                        if (activeMonths.length === 0) {
                          return (
                            <div className="table-row">
                              <span>No active accounts</span>
                              <span>$0</span>
                            </div>
                          );
                        }
                        return activeMonths.map((monthData, index) => (
                          <div className="table-row" key={index}>
                            <span>{monthData.month}</span>
                            <span>${monthData.rate}</span>
                          </div>
                        ));
                      })()}
                      <div className="table-row table-total">
                        <span><b>Total Annual Rate</b></span>
                        <span><b>${calculateTotalAnnualRate()}</b></span>
                      </div>
                    </div>
                  </div>
                  {/* Table 2: Pricing Breakdown */}
                  <div className="dashboard-table pricing-breakdown">
                    <div className="table-title"><b>Pricing Breakdown</b></div>
                    <div className={quoteGenerated ? '' : 'blurred'}>
                      {(() => {
                        const pricingData = getAnnualPricingData();
                        return (
                          <>
                            <div className="table-row">
                              <span>Total Annual Rate</span>
                              <span>${pricingData.totalAnnualRate}</span>
                            </div>
                            <div className="table-row">
                              <span>Annual Discount {pricingData.discountPercentage > 0 ? `(${Math.round(pricingData.discountPercentage * 100)}%)` : ''}</span>
                              <span>-${pricingData.discountAmount}</span>
                            </div>
                            <div className="table-row table-total">
                              <span><b>Discounted Rate</b></span>
                              <span><b>${pricingData.discountedRate}</b></span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Conditional Service Sections */}
      {selectedServices.includes('books') && (
        <BooksSection frequency={frequency} selectedYear={selectedYear} onAnyInputChange={handleAnyInputChange} setTotals={setBooksTotals} ref={booksSectionRef} showErrorTooltip={showBooksErrorTooltip} />
      )}
      {selectedServices.includes('payroll') && (
        <div className="service-section payroll-section">
          <hr />
          <PayrollSection setTotals={setPayrollTotals} onAnyInputChange={handleAnyInputChange} ref={payrollSectionRef} />
        </div>
      )}
      {selectedServices.includes('salesTax') && (
        <div className="service-section salestax-section">
          <hr />
          <SalesTaxSection setTotals={setSalesTaxTotals} onAnyInputChange={handleAnyInputChange} ref={salesTaxSectionRef} />
        </div>
      )}
      
      {/* Export Popup Modal */}
      {showExportPopup && (
        <div className="export-popup-overlay" onClick={() => setShowExportPopup(false)}>
          <div className="export-popup" onClick={(e) => e.stopPropagation()}>
            <div className="export-popup-header">
              <h3>Quote Exported Successfully!</h3>
              <button 
                className="export-popup-close"
                onClick={() => setShowExportPopup(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="export-popup-content">
              {(() => {
                const employeeName = getEmployeeName();
                if (!isMonthly) {
                  const data = generateAnnualPopupData();
                  return (
                    <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '10px', fontWeight: 600 }}>
                        Annual Services Quote - {selectedYear || 'Year'}{employeeName ? ` - ${employeeName}` : ''}
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <strong>Quote:</strong><br/>
                        <u>Books</u> - ${data.booksRate}<br/>
                        {data.accountDetails.map((account, index) => {
                          const getAccountAbbr = (type) => {
                            if (!type) return 'CK';
                            const lowerType = type.toLowerCase();
                            if (lowerType.includes('checking')) return 'CK';
                            if (lowerType.includes('savings')) return 'SA';
                            if (lowerType.includes('credit')) return 'CC';
                            return 'CK'; // default
                          };
                          const accountAbbr = getAccountAbbr(account.accountType);
                          const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
                          return (
                            <div key={index} style={{ marginLeft: '20px' }}>
                              • <strong>{accountAbbr} {account.lastFour || 'X'}</strong> - {avgTransactions} t/m
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <u><em>Cost of Services Adjustment:</em></u><br/>
                        <div style={{ marginLeft: '20px' }}>
                          • (provide details)
                        </div>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <u><em>Internal Notes:</em></u><br/>
                        <div style={{ marginLeft: '20px' }}>
                          • (provide details)
                        </div>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <u><em>Billing: (Please delete any fields that are not relevant)</em></u><br/>
                        + Total Quote Amount: ${data.totalAnnualRate}<br/>
                        - Annual Discount: ${data.annualDiscount} {data.discountPercent > 0 ? `(${Math.round(data.discountPercent * 100)}%)` : ''}<br/>
                        - Amount Paid: $<br/>
                        = <strong>Total Amount Due Today:</strong> ${data.discountedRate}<br/>
                      </div>
                    </div>
                  );
                }
                const data = generatePopupData();
                if (data.isSimple) {
                  return <p>{data.content}</p>;
                }
                return (
                  <div style={{ textAlign: 'left', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '10px', fontWeight: 600 }}>
                      Monthly Services Quote - {formatDate(new Date())}{employeeName ? ` - ${employeeName}` : ''}
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <strong>Quote:</strong><br/>
                      <u>Books</u> - ${data.booksRate}<br/>
                      {data.earliestMonth && <>Starting Month: {data.earliestMonth}<br/></>}
                      {data.accountDetails.map((account, index) => {
                        const getAccountAbbr = (type) => {
                          if (!type) return 'CK';
                          const lowerType = type.toLowerCase();
                          if (lowerType.includes('checking')) return 'CK';
                          if (lowerType.includes('savings')) return 'SA';
                          if (lowerType.includes('credit')) return 'CC';
                          return 'CK'; // default
                        };
                        const accountAbbr = getAccountAbbr(account.accountType);
                        const avgTransactions = (account.averages && typeof account.averages.total === 'number') ? account.averages.total : 0;
                        return (
                          <div key={index} style={{ marginLeft: '20px' }}>
                            • <strong>{accountAbbr} {account.lastFour || 'X'}</strong> - {avgTransactions} t/m
                          </div>
                        );
                      })}
                    </div>

                    {data.salesTaxRate > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <u>Sales Tax</u> - ${data.salesTaxRate}<br/>
                        Starting Month:<br/>
                        <div style={{ marginLeft: '20px' }}>
                          {data.salesTaxData && data.salesTaxData.length > 0 ? (
                            data.salesTaxData.map((salesTaxRow, index) =>
                              Array.from({ length: salesTaxRow.certificates }, (_, i) => {
                                const abbr = stateAbbreviations[salesTaxRow.state] || salesTaxRow.state;
                                return (
                                  <div key={`${index}-${i}`}>
                                    • <strong>{abbr}</strong>, {salesTaxRow.type}
                                  </div>
                                );
                              })
                            ).flat()
                          ) : (
                            <div>• <strong>STATE</strong>, Existing / New</div>
                          )}
                        </div>
                      </div>
                    )}

                    {data.payrollRate > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <u>Payroll</u> - ${data.payrollRate}<br/>
                        Starting Month:<br/>
                        <div style={{ marginLeft: '20px' }}>
                          {data.payrollData && data.payrollData.length > 0 ? (
                            data.payrollData.map((payrollRow, index) => {
                              const abbr = stateAbbreviations[payrollRow.state] || payrollRow.state;
                              return (
                                <div key={index}>
                                  • <strong>{payrollRow.employees} Employees</strong>, <strong>{abbr}</strong>, {payrollRow.type} Account
                                </div>
                              );
                            })
                          ) : (
                            <div>• <strong>X Employees</strong>, <strong>STATE</strong>, Existing / New Account</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                      <u><em>Cost of Services Adjustment:</em></u><br/>
                      <div style={{ marginLeft: '20px' }}>
                        • (provide details)
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <u><em>Internal Notes:</em></u><br/>
                      <div style={{ marginLeft: '20px' }}>
                        • (provide details)
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <u><em>Billing: (Please delete any fields that are not relevant)</em></u><br/>
                      + Cost of <em>Services Adjustment:</em> $<br/>
                      <div style={{ marginLeft: '20px' }}>
                        • [Cost since start date]
                      </div>
                      {payrollTotals.setup > 0 && (
                        <>+ <em>Payroll Set Up:</em> ${payrollTotals.setup}<br/></>
                      )}
                      {salesTaxTotals.setup > 0 && (
                        <>+ <em>Sales Tax Set Up:</em> ${salesTaxTotals.setup}<br/></>
                      )}
                      - <em>Discounts:</em> $<br/>
                      = <strong>Total Amount Due Today:</strong> $<br/>
                    </div>

                    <div>
                      <em>Monthly Rate - All Services:</em> ${data.totalMonthlyRate}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="export-popup-actions">
              {(() => {
                const data = isMonthly ? generatePopupData() : generateAnnualPopupData();
                return !data.isSimple ? (
                  <button 
                    className="export-popup-btn primary"
                    onClick={copyToClipboard}
                    type="button"
                    style={{ marginRight: '10px' }}
                  >
                    Copy Text
                  </button>
                ) : null;
              })()}
              <button 
                className="export-popup-btn secondary"
                onClick={() => setShowExportPopup(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Notification */}
      {showCopyNotification && (
        <div className="copy-notification-overlay">
          <div className="copy-notification">
            <div className="copy-notification-icon">✓</div>
            <div className="copy-notification-content">
              <div className="copy-notification-title">Success!</div>
              <div className="copy-notification-message">Copied to clipboard</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
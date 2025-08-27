# Quote App

A React-based quote application for generating and managing quotes with various calculators and sections.

## Features

- **Quote Form**: Create and manage quotes
- **Dashboard**: Overview and management interface
- **Books Section**: Bookkeeping related functionality
- **Payroll Section**: Payroll calculations and management
- **Sales Tax Section**: Sales tax calculations
- **Monthly Calculators**: Various monthly calculation tools

## Technology Stack

- React 19.1.0
- React DOM 19.1.0
- jsPDF for PDF generation
- jsPDF-AutoTable for table generation in PDFs
- React Scripts 5.0.1
- Progressive Web App (PWA) support

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DedicatedCPA/QuoteApp.git
   cd QuoteApp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
src/
├── components/          # React components
│   ├── BooksSection.js
│   ├── Dashboard.js
│   ├── Header.js
│   ├── PayrollSection.js
│   ├── QuoteForm.js
│   └── SalesTaxSection.js
├── calculators/         # Calculation utilities
│   └── monthlyCalculators.js
├── styles/             # CSS styles
│   ├── animations.css
│   ├── app.css
│   ├── buttons.css
│   ├── forms.css
│   └── variables.css
└── App.js              # Main application component
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please contact the development team. 
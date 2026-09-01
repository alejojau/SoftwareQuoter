# SoftwareQuoter

A comprehensive software development quoter tool that helps estimate project timelines, complexity, and costs based on:
- **Requirements Analysis** - Break down project scope and features
- **Technology Stack** - Account for different tech stack complexities
- **Team Experience** - Factor in team expertise levels
- **Risk Assessment** - Include contingency for unknowns
- **Resource Allocation** - Calculate labor costs and overhead

## Features (Planned)

- [ ] Interactive requirement specification builder
- [ ] Complexity assessment calculator
- [ ] Multiple estimation methodologies (Story Points, T-shirt sizing, etc.)
- [ ] Cost breakdown by role and technology
- [ ] PDF quote generation
- [ ] Project timeline visualization
- [ ] Team capacity planning
- [ ] Historical data analysis

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React + TypeScript
- **Database:** (To be determined)
- **Deployment:** (To be determined)

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### Running the Application

```bash
# Start both server and client in development mode
npm run dev

# Or run them separately:
# Terminal 1
npm run server

# Terminal 2
npm run client
```

## Project Structure

```
SoftwareQuoter/
├── server.js              # Express server entry point
├── package.json           # Backend dependencies
├── .gitignore            # Git ignore rules
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── utils/        # Utility functions
│   │   └── App.js        # Main app component
│   ├── public/           # Static assets
│   └── package.json      # Frontend dependencies
└── docs/                 # Documentation
```

## Contributing

Contributions are welcome! Please follow the coding standards and submit pull requests.

## License

MIT License - See LICENSE file for details

# Dynamic Form Generator with Monday.com Integration

## Overview

This is a Flask web application that dynamically generates forms based on webhooks from Monday.com boards. The system creates custom evaluation forms for three types of users (Guias/Guides, Clientes/Clients, Fornecedores/Suppliers) and integrates with Monday.com's API to update boards with form links and responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Flask with Python
- **Deployment**: Vercel serverless platform
- **Structure**: Modular blueprint-based architecture for scalability
- **API Design**: RESTful endpoints for webhook handling

### Frontend Architecture
- **Template Engine**: Jinja2 with Flask
- **Styling**: Bootstrap 5 + custom CSS with CSS variables
- **JavaScript**: Vanilla JS for admin interface interactions
- **Responsive Design**: Mobile-first approach with Bootstrap grid

### Configuration Management
- **File-based Config**: JSON configuration file (`setup/config.json`)
- **Dynamic Setup**: Admin interface for managing form configurations
- **Per-type Settings**: Separate configurations for each form type (Guias, Clientes, Fornecedores)

## Key Components

### 1. Webhook Endpoints (`/api/`)
- `POST /formguias` - Handles guide evaluation forms
- `POST /formclientes` - Handles client evaluation forms  
- `POST /formfornecedores` - Handles supplier evaluation forms

Each endpoint:
- Receives Monday.com webhook data
- Loads type-specific configuration
- Generates dynamic forms using FormGenerator
- Updates Monday.com boards with form links

### 2. Form Generation System (`utils/form_generator.py`)
- **Dynamic Form Creation**: Generates unique form IDs and HTML
- **Question Types**: Supports yes/no, rating, and long text questions
- **Template Rendering**: Uses Jinja2 templates for consistent styling
- **In-memory Storage**: Current implementation uses dictionary storage (needs database integration)

### 3. Monday.com Integration (`utils/monday_api.py`)
- **GraphQL API Client**: Handles Monday.com API communication
- **Board Operations**: Retrieves board data and updates columns
- **Error Handling**: Comprehensive error logging and exception handling
- **Authentication**: Uses environment variable for API token

### 4. Admin Interface (`/admin`)
- **Configuration Management**: Web-based setup for form configurations
- **Tab-based Interface**: Separate configuration for each form type
- **Dynamic Question Management**: Add/remove questions through UI
- **Board Mapping**: Configure source and destination Monday.com boards

## Data Flow

1. **Webhook Reception**: Monday.com sends webhook to appropriate endpoint
2. **Configuration Loading**: System loads form-specific configuration from JSON
3. **Form Generation**: FormGenerator creates unique form with configured questions
4. **Monday.com Update**: Form link is posted back to specified Monday.com board column
5. **Form Submission**: Users fill out generated forms
6. **Response Processing**: Form responses are processed and can be sent back to Monday.com

## External Dependencies

### Required Services
- **Monday.com API**: Primary integration for board data and updates
- **Vercel**: Serverless hosting platform for deployment

### Python Dependencies
- **Flask**: Web framework and routing
- **Requests**: HTTP client for Monday.com API calls
- **Werkzeug**: WSGI utilities and middleware

### Frontend Dependencies
- **Bootstrap 5**: CSS framework for responsive design
- **Feather Icons**: Icon library for UI elements

## Deployment Strategy

### Vercel Configuration
- **Build Target**: Python serverless functions
- **Entry Point**: `app.py` as main application file
- **Environment Variables**: Monday.com API token secured in Vercel settings
- **Static Assets**: CSS, JS, and images served from `/static/` directory

### Environment Setup
- `MONDAY_API_TOKEN`: Required for Monday.com API authentication
- `SESSION_SECRET`: Flask session security (has fallback for development)

### Recent Changes (January 2025)
- **Header Fields Integration**: Added 4 configurable header fields per form type that pull data from Monday.com Board A
- **Conditional Questions**: Implemented conditional logic for questions (show/hide based on Yes/No responses)
- **Enhanced Admin Interface**: Added header field configuration and conditional question setup
- **Form Styling**: Updated CSS with proper background image support and color overlays for different form types
- **Background Integration**: Added support for fundo.png background with #8bc9ba color overlay
- **Monday Column Questions**: Added "Coluna do Monday" question type that displays data from Monday.com Board A columns
- **Destination Column Mapping**: Added destination column configuration for saving form responses to Monday.com Board B
- **Dynamic Data Population**: Questions now pull real-time data from Monday.com based on webhook item ID
- **Form Submission Integration**: Form responses are automatically saved to specified Monday.com Board B columns
- **Dropdown Questions**: Added "Lista Suspensa" question type with semicolon-separated options configuration

### Current Limitations
- **Data Persistence**: Uses in-memory storage for forms (needs database integration)
- **Form Responses**: No persistent storage for submitted form data
- **Scalability**: Current storage solution doesn't support multiple instances

### Recommended Improvements
- **Database Integration**: Add PostgreSQL with Drizzle ORM for persistent storage
- **Response Storage**: Implement form response persistence and Monday.com sync
- **Error Recovery**: Add retry mechanisms for Monday.com API failures
- **Caching**: Implement configuration caching for better performance
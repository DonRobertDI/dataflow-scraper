# DataFlow: E-Commerce Scraper

A modern full-stack web application for extracting and analyzing e-commerce product data. DataFlow provides a clean dashboard for scraping product information, managing extraction history, and viewing documentation, with a React frontend and Python backend.

---

## Features

- Modern and responsive dashboard
- E-commerce product scraping
- Extraction history tracking
- Documentation section
- User authentication
- REST API integration
- Docker support
- Clean, scalable project structure

---

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS
- JavaScript

### Backend
- Python
- FastAPI

### DevOps
- Docker
- Docker Compose

---

## Project Structure

```
dataflow-scraper/
│
├── apps/
│   └── web/             # React + Vite frontend
│
├── backend/             # Python backend
│
├── vault/               # Project documentation
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (optional)

---

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/dataflow-scraper.git

cd dataflow-scraper
```

---

### Frontend

```bash
cd apps/web

npm install

npm run dev
```

The frontend will be available at:

```
http://localhost:5173
```

---

### Backend

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it.

Windows

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Run the backend:

```bash
python backend/main.py
```

---

### Docker

Start everything:

```bash
docker compose up --build
```

---

## Environment Variables

Create a `.env` file based on `.env.example`.

Example:

```
API_URL=http://localhost:8000
```

---

## Screenshots

### Dashboard

> Add a screenshot here.

### Results

> Add a screenshot here.

### Documentation

> Add a screenshot here.

---

## Future Improvements

- User authentication
- Export results to CSV/Excel
- Scheduled scraping
- Multiple marketplace support
- AI-powered product insights
- Dark mode
- User accounts and saved projects

---

## Author

**Don Robert Dimasayao**

Computer Science student passionate about full-stack development, AI, automation, and building real-world software solutions.

LinkedIn:
https://www.linkedin.com/in/donrobertdimasayao/

GitHub:
https://github.com/YOUR_USERNAME

---

## License

This project is licensed under the MIT License.


# 🚀 DevPilot

### API Monitoring & Analytics Platform

DevPilot is a backend monitoring and analytics platform designed to track API performance, monitor request failures, and provide insights into server health.

It helps developers understand how their APIs behave by collecting request metrics, tracking errors, and measuring response latency.

## ✨ Features

- **API Health Monitoring** – Monitor backend service health.
- **Request Tracking** – Track incoming API requests.
- **Error Monitoring** – Monitor failed requests and server errors.
- **Performance Analytics** – Calculate average API response latency.
- **Error Rate Calculation** – Measure the percentage of failed requests.
- **MongoDB Integration** – Store monitoring data.
- **TypeScript Backend** – Maintain type safety and cleaner code.

## 🛠️ Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- Zod
- tsx

## 📊 Monitoring Metrics

DevPilot tracks the following performance metrics:

| Metric | Description |
|---|---|
| Total Requests | Total API requests received |
| Failed Requests | Number of failed requests |
| Server Errors | Number of server errors |
| Error Rate | Percentage of failed requests |
| Average Latency | Average API response time in milliseconds |

### Example Metrics Response

```json
{
  "success": true,
  "metrics": {
    "totalRequests": 53,
    "failedRequests": 13,
    "serverErrors": 10,
    "errorRate": 24.53,
    "averageLatencyMs": 1740.3
  }
}
```

## 📁 Project Structure

```text
devpilot/
├── src/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── controllers/
│   └── server.ts
├── docs/
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── tsconfig.json
```

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/echosweta/devpilot.git
cd devpilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
```

### 4. Start the development server

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
npm start
```

## 🔍 API Health Check

**Endpoint:**

```http
GET http://localhost:3000/health
```

**Example Response:**

```json
{
  "status": "healthy",
  "service": "DevPilot API"
}
```

## 🗺️ Roadmap

- [x] Express + TypeScript backend setup
- [x] MongoDB integration
- [x] Health check endpoint
- [x] Request metrics and analytics
- [x] Logs API
- [ ] Real-time monitoring dashboard
- [ ] API latency visualization
- [ ] Rate limiting
- [ ] Alerting and notifications
- [ ] Docker deployment
- [ ] Authentication and API key management

## 🎯 Project Goals

- Understand API observability.
- Implement request lifecycle monitoring.
- Build middleware-based instrumentation.
- Explore backend performance analytics.
- Design scalable monitoring architecture.

## 👩‍💻 Author

**Sweta Thakur**

Software Engineer | Backend Development | AI Engineering

GitHub: [@echosweta](https://github.com/echosweta)

---

⭐ If you find DevPilot interesting, consider starring the repository!

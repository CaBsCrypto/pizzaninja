# Milestone 1 Technical Design & Implementation Specification

## 1. Executive Summary & Scope Overview

This document specifies the complete technical design, SQL DDL/seed scripts, core HTTP pipeline classes, database wrapper, and front controller for **Milestone 1** of the **SpicyCrust Game Ecosystem API**.

The objective of Milestone 1 is to establish the foundation of the project:
1. Database DDL schema (`database/schema.sql`) for games, players, seasons, and scores with indexes designed for high-performance leaderboard queries.
2. Seed data script (`database/seed.sql`) with 2 test games, 3 sample players, 1 active season, 1 past season, and sample score records with JSON metadata.
3. Configuration template (`.env.example`) supporting both MySQL (`pdo_mysql`) and SQLite (`pdo_sqlite`) drivers.
4. PDO Database wrapper (`src/Database/Connection.php`) providing prepared statement execution and fetch helpers.
5. Lightweight HTTP Core (`src/Http/Request.php`, `src/Http/Response.php`, `src/Http/Router.php`).
6. Front Controller (`public/index.php`) featuring lightweight `.env` loading, PSR-4 autoloading, exception/error handling, and route dispatching.
7. Health Controller (`src/Controllers/HealthController.php`) implementing `GET /api/v1/health` returning `{"success": true, "data": {"status": "ok"}}`.

---

## 2. Directory & Namespace Structure

PSR-4 Namespace Root: `App\` mapped to directory `src/`.

```
spicycrust-game-api/
├── .env.example
├── public/
│   ├── .htaccess
│   └── index.php
├── database/
│   ├── schema.sql
│   └── seed.sql
└── src/
    ├── Database/
    │   └── Connection.php
    ├── Http/
    │   ├── Request.php
    │   ├── Response.php
    │   └── Router.php
    └── Controllers/
        └── HealthController.php
```

---

## 3. Database Schema DDL (`database/schema.sql`)

The schema supports both MySQL and SQLite database engines. Standard ANSI SQL types are used to ensure compatibility.

```sql
-- SpicyCrust Game Ecosystem API Schema DDL
-- Compatible with MySQL 8.x and SQLite 3.x

-- 1. Games Table
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(128) NOT NULL UNIQUE,
    nickname VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seasons Table
CREATE TABLE IF NOT EXISTS seasons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    start_at DATETIME NOT NULL,
    end_at DATETIME NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Scores Table
CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    season_id INT NULL,
    score BIGINT NOT NULL,
    metadata TEXT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL
);

-- Performance Indexes for Leaderboards & Lookups
CREATE INDEX idx_games_slug ON games(slug);
CREATE INDEX idx_players_external_id ON players(external_id);
CREATE INDEX idx_seasons_is_active ON seasons(is_active);
CREATE INDEX idx_seasons_slug ON seasons(slug);

-- Leaderboard Query Optimization Indexes
CREATE INDEX idx_scores_game_season_score ON scores(game_id, season_id, score DESC);
CREATE INDEX idx_scores_game_score ON scores(game_id, score DESC);
CREATE INDEX idx_scores_player_score ON scores(player_id, score DESC);
CREATE INDEX idx_scores_season_score ON scores(season_id, score DESC);
```

### Leaderboard Indexing Rationale
- `idx_scores_game_season_score`: Covers `WHERE game_id = ? AND season_id = ? ORDER BY score DESC` for per-game season leaderboards.
- `idx_scores_game_score`: Covers `WHERE game_id = ? ORDER BY score DESC` for all-time per-game leaderboards.
- `idx_scores_season_score`: Covers `WHERE season_id = ? ORDER BY score DESC` for global season leaderboards.

---

## 4. Database Seed Data (`database/seed.sql`)

Includes test credentials and initial sample data.

```sql
-- Seed Data for SpicyCrust Game Ecosystem API

-- Seed Games
-- API Key 1: sk_test_spicyninja_1234567890abcdef
-- SHA-256 Hash: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
-- API Key 2: sk_test_crustracer_abcdef1234567890
-- SHA-256 Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (example hash)

INSERT INTO games (id, slug, name, api_key_hash, created_at) VALUES
(1, 'spicy-ninja', 'Spicy Ninja', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', '2026-01-01 00:00:00'),
(2, 'crust-racer', 'Crust Racer', '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4', '2026-01-01 00:00:00');

-- Seed Players
INSERT INTO players (id, external_id, nickname, created_at) VALUES
(1, 'usr_alpha001', 'PepperKing', '2026-01-10 10:00:00'),
(2, 'usr_beta002', 'SalsaQueen', '2026-01-11 11:30:00'),
(3, 'usr_gamma003', 'HabaneroHero', '2026-01-12 14:15:00');

-- Seed Seasons
INSERT INTO seasons (id, slug, name, start_at, end_at, is_active, created_at) VALUES
(1, 'season-2025-q4', 'Winter Heat 2025', '2025-10-01 00:00:00', '2025-12-31 23:59:59', 0, '2025-10-01 00:00:00'),
(2, 'season-2026-q1', 'Spring Inferno 2026', '2026-01-01 00:00:00', '2026-12-31 23:59:59', 1, '2026-01-01 00:00:00');

-- Seed Scores
INSERT INTO scores (id, game_id, player_id, season_id, score, metadata, submitted_at) VALUES
(1, 1, 1, 2, 15500, '{"level":5,"accuracy":98.4,"character":"FireNinja"}', '2026-01-15 12:00:00'),
(2, 1, 2, 2, 18200, '{"level":7,"accuracy":95.1,"character":"IceNinja"}', '2026-01-16 14:20:00'),
(3, 1, 3, 1, 12000, '{"level":4,"accuracy":90.0,"character":"FireNinja"}', '2025-11-20 09:45:00'),
(4, 2, 1, 2, 4520, '{"track":"Volcano Loop","best_lap_ms":42100}', '2026-01-18 16:30:00'),
(5, 2, 2, 2, 4890, '{"track":"Volcano Loop","best_lap_ms":40500}', '2026-01-19 18:10:00');
```

---

## 5. Environment Configuration Template (`.env.example`)

```ini
# SpicyCrust Game Ecosystem API Configuration

APP_ENV=development
APP_SECRET=spicycrust_super_secret_key_change_in_production_2026

# Database Configuration
# Supported DB_DRIVER values: mysql, sqlite
DB_DRIVER=sqlite
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=spicycrust_db
DB_USER=root
DB_PASS=root
DB_FILE=database/spicycrust.sqlite

# CORS Settings
CORS_ALLOWED_ORIGINS=*

# Rate Limiting Settings
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

---

## 6. Database Connection Wrapper Specification (`src/Database/Connection.php`)

### Namespace & Class Signature
- Namespace: `App\Database`
- Class: `Connection`

### Responsibilities
- Manages singleton or static `PDO` database connections.
- Reads environment configuration (`DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_FILE`).
- Supports both `mysql` and `sqlite` drivers seamlessly.
- Provides helper methods: `query()`, `fetchOne()`, `fetchAll()`, `execute()`, `lastInsertId()`.

### Code Specification
```php
<?php

namespace App\Database;

use PDO;
use PDOException;
use RuntimeException;

class Connection
{
    private static ?PDO $instance = null;

    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            self::$instance = self::createConnection();
        }
        return self::$instance;
    }

    public static function setInstance(PDO $pdo): void
    {
        self::$instance = $pdo;
    }

    private static function createConnection(): PDO
    {
        $driver = getenv('DB_DRIVER') ?: 'sqlite';

        if ($driver === 'sqlite') {
            $dbFile = getenv('DB_FILE') ?: __DIR__ . '/../../database/spicycrust.sqlite';
            $dir = dirname($dbFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $dsn = "sqlite:" . $dbFile;
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            // Enable Foreign Keys in SQLite
            $pdo->exec("PRAGMA foreign_keys = ON;");
            return $pdo;
        }

        if ($driver === 'mysql') {
            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: '3306';
            $db   = getenv('DB_NAME') ?: 'spicycrust_db';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASS') ?: '';
            $charset = 'utf8mb4';

            $dsn = "mysql:host={$host};port={$port};dbname={$db};charset={$charset}";
            return new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }

        throw new RuntimeException("Unsupported DB_DRIVER: {$driver}");
    }

    public static function query(string $sql, array $params = []): \PDOStatement
    {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = self::query($sql, $params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::query($sql, $params);
        return $stmt->fetchAll();
    }

    public static function execute(string $sql, array $params = []): bool
    {
        $stmt = self::query($sql, $params);
        return $stmt->rowCount() > 0;
    }

    public static function lastInsertId(): string|false
    {
        return self::getInstance()->lastInsertId();
    }
}
```

---

## 7. HTTP Core Classes Specification

### 7.1 `src/Http/Request.php`

#### Namespace & Class Signature
- Namespace: `App\Http`
- Class: `Request`

#### Code Specification
```php
<?php

namespace App\Http;

class Request
{
    private string $method;
    private string $uri;
    private array $headers;
    private array $queryParams;
    private ?array $bodyParams;
    private string $rawBody;

    public function __construct(
        string $method,
        string $uri,
        array $headers = [],
        array $queryParams = [],
        ?array $bodyParams = null,
        string $rawBody = ''
    ) {
        $this->method = strtoupper($method);
        $this->uri = $uri;
        $this->headers = array_change_key_case($headers, CASE_LOWER);
        $this->queryParams = $queryParams;
        $this->bodyParams = $bodyParams;
        $this->rawBody = $rawBody;
    }

    public static function createFromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

        $headers = [];
        if (function_exists('getallheaders')) {
            $headers = getallheaders() ?: [];
        } else {
            foreach ($_SERVER as $key => $value) {
                if (str_starts_with($key, 'HTTP_')) {
                    $headerName = str_replace('_', '-', strtolower(substr($key, 5)));
                    $headers[$headerName] = $value;
                }
            }
        }

        $rawBody = file_get_contents('php://input') ?: '';
        $bodyParams = null;
        if (!empty($rawBody)) {
            $decoded = json_decode($rawBody, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $bodyParams = $decoded;
            }
        }

        return new self($method, $uri, $headers, $_GET, $bodyParams, $rawBody);
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getUri(): string
    {
        return $this->uri;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getHeader(string $name): ?string
    {
        $key = strtolower($name);
        return $this->headers[$key] ?? null;
    }

    public function getQueryParams(): array
    {
        return $this->queryParams;
    }

    public function getQuery(string $key, mixed $default = null): mixed
    {
        return $this->queryParams[$key] ?? $default;
    }

    public function getBody(): ?array
    {
        return $this->bodyParams;
    }

    public function getRawBody(): string
    {
        return $this->rawBody;
    }

    public function getBearerToken(): ?string
    {
        $authHeader = $this->getHeader('authorization');
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return trim($matches[1]);
        }
        return null;
    }
}
```

---

### 7.2 `src/Http/Response.php`

#### Namespace & Class Signature
- Namespace: `App\Http`
- Class: `Response`

#### Code Specification
```php
<?php

namespace App\Http;

class Response
{
    private int $statusCode;
    private array $data;
    private array $headers;

    public function __construct(int $statusCode = 200, array $data = [], array $headers = [])
    {
        $this->statusCode = $statusCode;
        $this->data = $data;
        $this->headers = $headers;
    }

    public static function json(array $data, int $statusCode = 200, array $headers = []): self
    {
        return new self($statusCode, $data, $headers);
    }

    public static function success(mixed $data = null, int $statusCode = 200): self
    {
        return new self($statusCode, [
            'success' => true,
            'data' => $data,
        ]);
    }

    public static function error(string $code, string $message, int $statusCode = 400, mixed $details = null): self
    {
        $errorPayload = [
            'code' => $code,
            'message' => $message,
        ];
        if ($details !== null) {
            $errorPayload['details'] = $details;
        }

        return new self($statusCode, [
            'success' => false,
            'error' => $errorPayload,
        ]);
    }

    public function setHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function setStatusCode(int $statusCode): self
    {
        $this->statusCode = $statusCode;
        return $this;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function send(): void
    {
        if (headers_sent()) {
            echo json_encode($this->data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code($this->statusCode);
        header('Content-Type: application/json; charset=utf-8');

        foreach ($this->headers as $name => $value) {
            header("{$name}: {$value}");
        }

        echo json_encode($this->data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
```

---

### 7.3 `src/Http/Router.php`

#### Namespace & Class Signature
- Namespace: `App\Http`
- Class: `Router`

#### Code Specification
```php
<?php

namespace App\Http;

class Router
{
    private array $routes = [];

    public function get(string $path, callable|array $handler): self
    {
        return $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable|array $handler): self
    {
        return $this->addRoute('POST', $path, $handler);
    }

    public function put(string $path, callable|array $handler): self
    {
        return $this->addRoute('PUT', $path, $handler);
    }

    public function delete(string $path, callable|array $handler): self
    {
        return $this->addRoute('DELETE', $path, $handler);
    }

    public function options(string $path, callable|array $handler): self
    {
        return $this->addRoute('OPTIONS', $path, $handler);
    }

    public function addRoute(string $method, string $path, callable|array $handler): self
    {
        $normalizedPath = '/' . trim($path, '/');
        $this->routes[strtoupper($method)][$normalizedPath] = $handler;
        return $this;
    }

    public function dispatch(Request $request): Response
    {
        $method = $request->getMethod();
        $uri = '/' . trim($request->getUri(), '/');

        // Check if route exists for method
        if (isset($this->routes[$method][$uri])) {
            return $this->callHandler($this->routes[$method][$uri], $request);
        }

        // Check if route exists under another HTTP method (405 Method Not Allowed)
        foreach ($this->routes as $routeMethod => $paths) {
            if ($routeMethod !== $method && isset($paths[$uri])) {
                return Response::error('METHOD_NOT_ALLOWED', 'Method not allowed for this route', 405);
            }
        }

        // Route Not Found (404)
        return Response::error('NOT_FOUND', 'Route not found', 404);
    }

    private function callHandler(callable|array $handler, Request $request): Response
    {
        if (is_array($handler) && count($handler) === 2 && is_string($handler[0])) {
            $class = $handler[0];
            $method = $handler[1];
            $controller = new $class();
            return $controller->$method($request);
        }

        if (is_callable($handler)) {
            return call_user_func($handler, $request);
        }

        return Response::error('INTERNAL_SERVER_ERROR', 'Invalid route handler', 500);
    }
}
```

---

## 8. Health Controller Specification (`src/Controllers/HealthController.php`)

### Namespace & Class Signature
- Namespace: `App\Controllers`
- Class: `HealthController`

### Code Specification
```php
<?php

namespace App\Controllers;

use App\Http\Request;
use App\Http\Response;

class HealthController
{
    public function index(Request $request): Response
    {
        return Response::success(['status' => 'ok']);
    }
}
```

---

## 9. Front Controller Specification (`public/index.php` & `public/.htaccess`)

### 9.1 `public/.htaccess`
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.php [QSA,L]
</IfModule>
```

### 9.2 `public/index.php`

```php
<?php

// 1. PSR-4 Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// 2. Simple Environment Loader (.env parser)
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (str_starts_with($line, '#') || empty($line)) {
            continue;
        }
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

use App\Http\Request;
use App\Http\Response;
use App\Http\Router;
use App\Controllers\HealthController;

// 3. Global Exception Handler
set_exception_handler(function (\Throwable $e) {
    $response = Response::error(
        'INTERNAL_SERVER_ERROR',
        getenv('APP_ENV') === 'development' ? $e->getMessage() : 'An unexpected error occurred',
        500
    );
    $response->send();
});

// 4. Request Instantiation & Router Setup
$request = Request::createFromGlobals();
$router = new Router();

// Register Milestone 1 Routes
$router->get('/api/v1/health', [HealthController::class, 'index']);

// 5. Dispatch Request & Emit Response
$response = $router->dispatch($request);
$response->send();
```

---

## 10. Step-by-Step Implementation Guide for Worker

The Worker agent should execute the following steps in exact sequence:

1. **Directories**: Create target directories in `spicycrust-game-api`:
   - `public/`
   - `database/`
   - `src/Database/`
   - `src/Http/`
   - `src/Controllers/`

2. **Database Scripts**:
   - Write `database/schema.sql` with table definitions and index statements.
   - Write `database/seed.sql` with initial game, player, season, and score seed records.

3. **Environment Config**:
   - Write `.env.example` with standard database and app settings.

4. **Database Connection Class**:
   - Write `src/Database/Connection.php` implementing PDO initialization for MySQL & SQLite and query helper functions.

5. **HTTP Core Classes**:
   - Write `src/Http/Request.php` handling method, URI, headers, body, query params, and bearer token parsing.
   - Write `src/Http/Response.php` supporting structured success and error envelopes and JSON output.
   - Write `src/Http/Router.php` matching routes to closures/controller methods and handling 404/405 errors.

6. **Controller Class**:
   - Write `src/Controllers/HealthController.php` returning `{"success": true, "data": {"status": "ok"}}`.

7. **Front Controller**:
   - Write `public/.htaccess` and `public/index.php` connecting PSR-4 autoloading, `.env` parsing, error handling, router dispatching, and sending response.

8. **Verification**:
   - Verify file existence, PHP syntax cleanliness, and structural alignment with `PROJECT.md`.

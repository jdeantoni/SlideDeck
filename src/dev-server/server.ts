import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { CompilerService } from '../services/compiler-service';

export interface DevServerOptions {
    port: number;
    initialFile?: string;
}

export class DevServer {
    private app = express();
    private httpServer = createServer(this.app);
    private io = new SocketIOServer(this.httpServer);
    private compiler = new CompilerService();
    private initialContent = '';

    constructor(private options: DevServerOptions) {
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    private setupMiddleware(): void {
        // Parse JSON bodies
        this.app.use(express.json({ limit: '10mb' }));

        // Serve static files from public directory
        // In development: src/dev-server/public
        // In production: out/dev-server/public (needs to be copied)
        const publicDir = path.join(__dirname, '../../src/dev-server/public');
        this.app.use(express.static(publicDir));
    }

    private setupRoutes(): void {
        // Main page
        this.app.get('/', (_req, res) => {
            const publicDir = path.join(__dirname, '../../src/dev-server/public');
            res.sendFile(path.join(publicDir, 'index.html'));
        });

        // Get initial content
        this.app.get('/api/initial-content', (_req, res) => {
            res.json({
                content: this.initialContent,
                filePath: this.options.initialFile || null
            });
        });

        // Compile endpoint
        this.app.post('/api/compile', async (req, res) => {
            try {
                const { content, cursorLine } = req.body;
                const result = await this.compiler.compile(
                    content,
                    cursorLine,
                    this.options.initialFile
                );
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });

        // Save file endpoint
        this.app.post('/api/save', (req, res) => {
            try {
                const { content, filePath } = req.body;

                // Use the provided filePath or the initially loaded file
                const targetPath = filePath || this.options.initialFile;

                if (!targetPath) {
                    return res.status(400).json({
                        error: 'No file path specified. Cannot save without a file path.'
                    });
                }

                // Write to file
                fs.writeFileSync(targetPath, content, 'utf-8');

                res.json({
                    success: true,
                    message: `File saved: ${path.basename(targetPath)}`,
                    filePath: targetPath
                });
            } catch (error) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });
    }

    private setupWebSocket(): void {
        this.io.on('connection', (socket) => {
            console.log('Client connected');

            // Handle compilation requests via WebSocket
            socket.on('compile', async (data: { content: string, cursorLine?: number }) => {
                try {
                    const result = await this.compiler.compile(
                        data.content,
                        data.cursorLine,
                        this.options.initialFile
                    );
                    socket.emit('compilation-result', result);
                } catch (error) {
                    socket.emit('compilation-error', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });
    }

    async start(): Promise<void> {
        // Load initial file if provided
        if (this.options.initialFile) {
            if (fs.existsSync(this.options.initialFile)) {
                this.initialContent = fs.readFileSync(this.options.initialFile, 'utf-8');
                console.log(`Loaded file: ${this.options.initialFile}`);
            } else {
                console.warn(`Warning: File not found: ${this.options.initialFile}`);
                this.initialContent = this.getDefaultContent();
            }
        } else {
            this.initialContent = this.getDefaultContent();
        }

        return new Promise((resolve) => {
            this.httpServer.listen(this.options.port, () => {
                console.log(`\n🚀 SlideDeck Dev Server running!`);
                console.log(`📝 Editor: http://localhost:${this.options.port}`);
                console.log(`\nPress Ctrl+C to stop\n`);
                resolve();
            });
        });
    }

    private getDefaultContent(): string {
        return `# Welcome to SlideDeck

This is your first slide!

Try editing this text and watch it update in real-time.

===

## Second Slide

**Bold text** and *italic text* work great!

- Bullet point 1
- Bullet point 2

===

### Third Slide

> This is a quote

You can add more slides by using \`===\` as a separator.
`;
    }

    stop(): void {
        this.httpServer.close();
        console.log('Server stopped');
    }
}

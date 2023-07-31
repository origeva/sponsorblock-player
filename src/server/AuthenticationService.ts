import crypto from 'crypto'
const tempUsers = new Map<string, string>([['admin', 'admin']])

export class AuthenticationService {
    
    private static instance: AuthenticationService
    private readonly sessions = new Map<string, string>()
    
    private constructor() { }

    public static getInstance(): AuthenticationService {
        return this.instance || (this.instance = new AuthenticationService())
    }

    public login(username: string, password: string): string | null {
        if (tempUsers.get(username) === password) {
            const token = crypto.randomUUID()
            this.sessions.set(token, username)
            return token
        }
        return null
    }

    public authorize(token: string): boolean {
        return this.sessions.get(token) !== undefined
    }

}
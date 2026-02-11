'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusCheck {
    name: string;
    status: 'success' | 'error' | 'warning' | 'checking';
    message: string;
}

export function SystemStatusCard() {
    const [checks, setChecks] = useState<StatusCheck[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    const runChecks = async () => {
        setIsChecking(true);
        const newChecks: StatusCheck[] = [];

        // Check 1: Database connection
        try {
            const { error } = await supabase.from('profiles').select('count').limit(1);
            newChecks.push({
                name: 'Connexion base de données',
                status: error ? 'error' : 'success',
                message: error ? error.message : 'Connecté à Supabase'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Connexion base de données',
                status: 'error',
                message: e.message
            });
        }

        // Check 2: day_resources table
        try {
            const { error } = await supabase.from('day_resources').select('count').limit(1);
            newChecks.push({
                name: 'Table day_resources',
                status: error ? 'error' : 'success',
                message: error ? 'Table manquante - Exécutez supabase-migrations.sql' : 'Table existe'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Table day_resources',
                status: 'error',
                message: 'Table manquante - Exécutez supabase-migrations.sql'
            });
        }

        // Check 3: testimonials table with is_approved column
        try {
            const { data, error } = await supabase
                .from('testimonials')
                .select('is_approved')
                .limit(1);

            newChecks.push({
                name: 'Table testimonials',
                status: error ? 'error' : 'success',
                message: error ? 'Table ou colonne manquante' : 'Table configurée correctement'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Table testimonials',
                status: 'error',
                message: 'Table ou colonne manquante'
            });
        }

        // Check 4: Storage bucket - day-resources
        try {
            const { data, error } = await supabase.storage
                .from('day-resources')
                .list('', { limit: 1 });

            newChecks.push({
                name: 'Bucket day-resources',
                status: error ? 'error' : 'success',
                message: error ? 'Bucket manquant - Voir QUICK_START.md' : 'Bucket configuré'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Bucket day-resources',
                status: 'error',
                message: 'Bucket manquant - Voir QUICK_START.md'
            });
        }

        // Check 5: Storage bucket - testimonial-photos
        try {
            const { data, error } = await supabase.storage
                .from('testimonial-photos')
                .list('', { limit: 1 });

            newChecks.push({
                name: 'Bucket testimonial-photos',
                status: error ? 'error' : 'success',
                message: error ? 'Bucket manquant - Voir QUICK_START.md' : 'Bucket configuré'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Bucket testimonial-photos',
                status: 'error',
                message: 'Bucket manquant - Voir QUICK_START.md'
            });
        }

        // Check 6: Authentication
        try {
            const { data: { user } } = await supabase.auth.getUser();
            newChecks.push({
                name: 'Authentication',
                status: user ? 'success' : 'warning',
                message: user ? `Connecté en tant que ${user.email}` : 'Non connecté'
            });
        } catch (e: any) {
            newChecks.push({
                name: 'Authentication',
                status: 'error',
                message: e.message
            });
        }

        setChecks(newChecks);
        setIsChecking(false);
    };

    useEffect(() => {
        runChecks();
    }, []);

    const getStatusIcon = (status: StatusCheck['status']) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'error':
                return <XCircle className="h-5 w-5 text-red-500" />;
            case 'warning':
                return <AlertCircle className="h-5 w-5 text-orange-500" />;
            case 'checking':
                return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
        }
    };

    const getStatusBadge = (status: StatusCheck['status']) => {
        switch (status) {
            case 'success':
                return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">OK</Badge>;
            case 'error':
                return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erreur</Badge>;
            case 'warning':
                return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">Attention</Badge>;
            case 'checking':
                return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Vérification...</Badge>;
        }
    };

    const successCount = checks.filter(c => c.status === 'success').length;
    const totalChecks = checks.length;
    const allGood = successCount === totalChecks && totalChecks > 0;

    return (
        <Card className="border-white/10">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            {allGood ? (
                                <CheckCircle className="h-6 w-6 text-green-500" />
                            ) : (
                                <AlertCircle className="h-6 w-6 text-orange-500" />
                            )}
                            Statut du système
                        </CardTitle>
                        <CardDescription>
                            {allGood
                                ? '✅ Tous les systèmes sont opérationnels'
                                : `${successCount}/${totalChecks} vérifications réussies`
                            }
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={runChecks}
                        disabled={isChecking}
                    >
                        <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {checks.map((check, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                check.status === 'success' && "bg-green-500/5 border-green-500/20",
                                check.status === 'error' && "bg-red-500/5 border-red-500/20",
                                check.status === 'warning' && "bg-orange-500/5 border-orange-500/20",
                                check.status === 'checking' && "bg-blue-500/5 border-blue-500/20"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {getStatusIcon(check.status)}
                                <div>
                                    <p className="font-medium text-sm">{check.name}</p>
                                    <p className="text-xs text-muted-foreground">{check.message}</p>
                                </div>
                            </div>
                            {getStatusBadge(check.status)}
                        </div>
                    ))}
                </div>

                {!allGood && checks.length > 0 && (
                    <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <p className="text-sm text-orange-500 font-medium mb-2">
                            ⚠️ Configuration incomplète
                        </p>
                        <p className="text-xs text-orange-400">
                            Consultez <code className="bg-black/20 px-1 py-0.5 rounded">QUICK_START.md</code> pour terminer la configuration.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

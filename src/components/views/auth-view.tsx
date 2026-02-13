'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, Phone, MapPin, Building, Globe, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppStore } from '@/lib/store';

export function AuthView() {
    const { signIn, signUp, isLoading, authError, clearAuthError } = useAppStore();
    const [activeTab, setActiveTab] = useState('signup'); // Default to signup for engagement

    // Login state
    const [loginPhone, setLoginPhone] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Signup State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginPhone || !loginPassword) return;
        // Reconstruct fake email from phone
        const cleanPhone = loginPhone.replace(/\D/g, '');
        const email = `${cleanPhone}@marathon.local`;
        await signIn(email, loginPassword);
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firstName || !country || !whatsapp || !signupPassword) return;

        await signUp({
            firstName,
            lastName,
            country,
            city,
            whatsapp,
            password: signupPassword
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-spiritual via-primary to-spiritual/80">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Card className="border-none shadow-2xl bg-background/95 backdrop-blur-sm">
                    <CardHeader className="text-center pb-2">
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-4xl"
                        >
                            🙏
                        </motion.div>
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-spiritual bg-clip-text text-transparent">
                            Marathon de Prière
                        </CardTitle>
                        <CardDescription>
                            Connectez-vous simplement avec votre numéro WhatsApp
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {authError && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mb-4"
                            >
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Erreur</AlertTitle>
                                    <AlertDescription>{authError}</AlertDescription>
                                </Alert>
                            </motion.div>
                        )}

                        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); clearAuthError(); }}>
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="login">Connexion</TabsTrigger>
                                <TabsTrigger value="signup">Inscription</TabsTrigger>
                            </TabsList>

                            <AnimatePresence mode="wait">
                                <TabsContent value="login" className="space-y-4">
                                    <motion.form
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: 20, opacity: 0 }}
                                        onSubmit={handleLogin}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    type="tel"
                                                    placeholder="Numéro WhatsApp (ex: +221 77...)"
                                                    value={loginPhone}
                                                    onChange={(e) => setLoginPhone(e.target.value)}
                                                    className="pl-10"
                                                    required
                                                />
                                                <p className="text-[10px] text-muted-foreground mt-1 pl-1">Avec l'indicatif du pays (ex: +221, +225, +33...)</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    type={showLoginPassword ? 'text' : 'password'}
                                                    placeholder="Mot de passe"
                                                    value={loginPassword}
                                                    onChange={(e) => setLoginPassword(e.target.value)}
                                                    className="pl-10 pr-10"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full gradient-spiritual text-white"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Connexion...
                                                </>
                                            ) : (
                                                <>
                                                    Se connecter
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </>
                                            )}
                                        </Button>
                                    </motion.form>
                                </TabsContent>

                                <TabsContent value="signup" className="space-y-4">
                                    <motion.form
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: -20, opacity: 0 }}
                                        onSubmit={handleSignup}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    placeholder="Prénom"
                                                    value={firstName}
                                                    onChange={(e) => setFirstName(e.target.value)}
                                                    className="pl-10"
                                                    required
                                                />
                                            </div>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    placeholder="Nom"
                                                    value={lastName}
                                                    onChange={(e) => setLastName(e.target.value)}
                                                    className="pl-10"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    placeholder="Pays"
                                                    value={country}
                                                    onChange={(e) => setCountry(e.target.value)}
                                                    className="pl-10"
                                                    required
                                                />
                                            </div>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                                <Input
                                                    placeholder="Ville"
                                                    value={city}
                                                    onChange={(e) => setCity(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                            <Input
                                                type="tel"
                                                placeholder="Numéro WhatsApp (ex: +221 77...)"
                                                value={whatsapp}
                                                onChange={(e) => setWhatsapp(e.target.value)}
                                                className="pl-10"
                                                required
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-1 pl-1">Avec l'indicatif du pays (ex: +221, +225, +33...)</p>
                                        </div>

                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                            <Input
                                                type={showSignupPassword ? 'text' : 'password'}
                                                placeholder="Mot de passe (pour sécuriser)"
                                                value={signupPassword}
                                                onChange={(e) => setSignupPassword(e.target.value)}
                                                className="pl-10 pr-10"
                                                minLength={6}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSignupPassword(!showSignupPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full gradient-gold text-gold-foreground mt-2"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Inscription...
                                                </>
                                            ) : (
                                                <>
                                                    Rejoindre le Marathon
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </>
                                            )}
                                        </Button>
                                    </motion.form>
                                </TabsContent>
                            </AnimatePresence>
                        </Tabs>
                    </CardContent>
                    <CardFooter className="justify-center text-xs text-muted-foreground">
                        Rejoignez une communauté de prière mondiale
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}

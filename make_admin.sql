-- PROMOTION ADMIN
-- Pour tester le backoffice, exécutez ce script pour promouvoir tous les utilisateurs actuels en ADMIN.
-- Attention: En production, ciblez un utilisateur spécifique avec WHERE email = '...'

UPDATE public.profiles
SET role = 'admin';

-- Vérification
SELECT email, first_name, last_name, role FROM public.profiles;

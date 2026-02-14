-- ============================================================
-- SCRIPT COMPLET DE CORRECTION DES CONVERSATIONS EN DOUBLE
-- Exécutez ce script dans l'éditeur SQL de Supabase
-- ============================================================

-- ÉTAPE 1 : Fonction RPC pour éviter les futurs doublons
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Cherche une conversation existante (dans les deux sens)
  SELECT id INTO conv_id
  FROM conversations
  WHERE (participant1_id = current_user_id AND participant2_id = other_user_id)
     OR (participant1_id = other_user_id AND participant2_id = current_user_id)
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si elle existe, on la retourne
  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Sinon, on la crée
  INSERT INTO conversations (participant1_id, participant2_id, created_at, last_message_at)
  VALUES (current_user_id, other_user_id, NOW(), NOW())
  RETURNING id INTO conv_id;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ÉTAPE 2 : Fusionner les conversations en double existantes
-- ============================================================
-- Ce bloc identifie les paires de participants ayant plusieurs conversations,
-- garde la plus ancienne, déplace les messages, et supprime les doublons.

DO $$
DECLARE
  rec RECORD;
  keeper_id UUID;
  dupe_id UUID;
BEGIN
  -- Pour chaque paire de participants ayant plus d'une conversation
  FOR rec IN (
    SELECT 
      LEAST(participant1_id, participant2_id) AS user_a,
      GREATEST(participant1_id, participant2_id) AS user_b,
      COUNT(*) as cnt
    FROM conversations
    GROUP BY LEAST(participant1_id, participant2_id), GREATEST(participant1_id, participant2_id)
    HAVING COUNT(*) > 1
  ) LOOP
    RAISE NOTICE 'Fusion des conversations entre % et % (% doublons)', rec.user_a, rec.user_b, rec.cnt;
    
    -- La conversation à garder est la plus ancienne
    SELECT id INTO keeper_id
    FROM conversations
    WHERE (
      (participant1_id = rec.user_a AND participant2_id = rec.user_b)
      OR (participant1_id = rec.user_b AND participant2_id = rec.user_a)
    )
    ORDER BY created_at ASC
    LIMIT 1;

    -- Toutes les autres conversations sont des doublons
    FOR dupe_id IN (
      SELECT id
      FROM conversations
      WHERE (
        (participant1_id = rec.user_a AND participant2_id = rec.user_b)
        OR (participant1_id = rec.user_b AND participant2_id = rec.user_a)
      )
      AND id != keeper_id
    ) LOOP
      -- Déplacer les messages du doublon vers la conversation principale
      UPDATE direct_messages 
      SET conversation_id = keeper_id 
      WHERE conversation_id = dupe_id;

      -- Supprimer le doublon
      DELETE FROM conversations WHERE id = dupe_id;
      
      RAISE NOTICE '  Doublon % fusionné dans %', dupe_id, keeper_id;
    END LOOP;

    -- Mettre à jour last_message_at de la conversation gardée
    UPDATE conversations 
    SET last_message_at = COALESCE(
      (SELECT MAX(created_at) FROM direct_messages WHERE conversation_id = keeper_id),
      last_message_at
    )
    WHERE id = keeper_id;
  END LOOP;
END $$;


-- ÉTAPE 3 : Vérification
-- ============================================================
-- Vérifie qu'il n'y a plus de doublons
SELECT 
  LEAST(participant1_id, participant2_id) AS user_a,
  GREATEST(participant1_id, participant2_id) AS user_b,
  COUNT(*) as conversation_count
FROM conversations
GROUP BY LEAST(participant1_id, participant2_id), GREATEST(participant1_id, participant2_id)
HAVING COUNT(*) > 1;
-- Si ce SELECT retourne 0 lignes, tout est propre !


-- ÉTAPE 4 (OPTIONNEL) : Ajouter une contrainte pour empêcher toute duplication future
-- ============================================================
-- Crée un index unique sur la paire normalisée (plus petit ID, plus grand ID)
-- Cela empêche physiquement la création de doublons même sans passer par la RPC

-- D'abord, normaliser les données existantes pour que participant1_id < participant2_id
UPDATE conversations 
SET participant1_id = participant2_id, participant2_id = participant1_id
WHERE participant1_id > participant2_id;

-- Puis créer la contrainte unique
CREATE UNIQUE INDEX IF NOT EXISTS unique_conversation_pair 
ON conversations (LEAST(participant1_id, participant2_id), GREATEST(participant1_id, participant2_id));

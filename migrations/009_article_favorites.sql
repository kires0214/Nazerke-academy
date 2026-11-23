CREATE TABLE builtin_article_favorites (
  user_id uuid NOT NULL REFERENCES users(id),
  article_key text NOT NULL CHECK(article_key IN ('kenwood','dough','care')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,article_key)
);

# Nekyflow

Uma interface web estilo streaming para descobrir e assistir filmes e séries, com a API do TMDB e players embutidos.

<p align="center">
  <a href="README.md#english">English</a> | <a href="#português">Português</a>
</p>

## Funcionalidades

- **Navegação** por filmes, séries, animações e mais
- **Filtro por gênero** para filmes e séries
- **Busca** por filmes, séries e pessoas
- **Favoritos e Minha Lista** com persistência local
- **Histórico de visualização**
- **Modais de detalhes** com elenco, recomendações e títulos similares
- **Player integrado** com streaming HLS e suporte a legendas
- **Design responsivo** — funciona em desktop e celular
- **PWA** com service worker para suporte offline
- **Sem build** — só abrir e rodar

## Configuração

1. Clone ou baixe este repositório
2. Copie `.env.example` para `.env` na raiz do projeto e cole sua chave da API TMDB:

```bash
cp .env.example .env
```

Depois edite `.env` e cole sua chave:

```
TMDB_API_KEY=sua_chave_aqui
```

Você pode obter uma chave gratuita em [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api).

## Execução

### Opção 1: Abrir diretamente (sem servidor)

Basta abrir `index.html` no navegador:

```
# macOS
open index.html

# Linux
xdg-open index.html
```

### Opção 2: Servidor HTTP local

Se preferir servir via HTTP:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Depois acesse `http://localhost:8080`.

## Estrutura do Projeto

```
Nekyflow/
├── index.html          # Ponto de entrada
├── .env                # Chave da API TMDB
├── sw.js               # Service worker (PWA)
├── css/
│   └── style.css       # Estilos
└── js/
    ├── api.js          # Wrapper da API TMDB com cache
    ├── app.js          # Lógica principal
    ├── config.js       # Configuração
    ├── player.js       # Player de vídeo HLS
    └── ui.js           # Carrossel e componentes UI
```

## Tecnologias

- **JavaScript puro** — sem frameworks
- **HLS.js** — streaming de vídeo
- **TMDB API** — metadados e imagens de filmes/séries
- **StreamIMDB** — reprodução embutida

## Licença

Este projeto é para uso pessoal. Dados e imagens do TMDB estão sujeitos aos [Termos de Uso do TMDB](https://www.themoviedb.org/terms-of-use).

# Mythoria 🖋️✨

Mythoria is a modern, comprehensive web application designed for novelists and storytellers. It provides a dedicated workspace to plan, write, and manage your novels, characters, worlds, and plotlines in one seamless interface.

## 🚀 Features

### 📚 Project Management
- **Dashboard**: Central hub for all your novels/projects.
- **Detailed Statistics**: Track word counts (total per novel and per chapter), progress towards goals, and chapter statuses (Draft/Published).
- **Metadata Management**: Easily update project titles, descriptions, status, and visibility.

### ✍️ Writing Suite
- **Chapter Management**: Create, edit, reorder, and organize chapters.
- **Rich Text Editor**: Distraction-free writing environment with formatting support (powered by Quill).
- **Notes System**: Attach sticky notes to specific chapters for quick reference or ideas.

### 🌍 World Building
- **Character Database**: Create detailed character profiles with attributes, roles, and backstories.
- **Relationship Board**: Visualize character connections and relationships on an interactive board.
- **Location Manager**: Document settings and places, including hierarchy and details.
- **Lore & Factions**: Manage factions, groups, and world lore.

### 🧩 Plotting & Planning
- **Idea Vault**: Store stray ideas, snippets, and inspiration in a centralized list.
- **Timeline Board**: Visually map out events on a timeline to ensure plot consistency.
- **Plot Playground**: Interactive canvas to organize scenes and plot points (using React Flow).

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Database & ORM**: PostgreSQL, [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **State & Interaction**: 
  - [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) for validation
  - [DnD Kit](https://dndkit.com/) for drag-and-drop
  - [React Flow](https://reactflow.dev/) for node-based visualizaions
  - [Sonner](https://sonner.emilkowal.ski/) for toast notifications

## 🏁 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- PostgreSQL database

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mythoria
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and configure your database connection and authentication secrets:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/mythoria"
   # Add other necessary auth secrets here
   ```

4. **Database Migration**
   Push the schema to your database:
   ```bash
   npm run db:push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

- `/app`: App Router pages and layouts.
  - `/dashboard`: Main authenticated interface.
  - `/api`: Server-side API routes.
- `/components`: Reusable UI components and feature-specific widgets.
- `/db`: Database schema and Drizzle configuration.
- `/lib`: Utility functions and shared helpers.
- `/server`: Server Actions and data access layer.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

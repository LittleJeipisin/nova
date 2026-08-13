-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "widgetEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "widgetPosition" "WidgetPosition" NOT NULL DEFAULT 'RIGHT',
ADD COLUMN     "widgetSubtitle" TEXT NOT NULL DEFAULT 'Soporte en línea',
ADD COLUMN     "widgetTitle" TEXT NOT NULL DEFAULT 'Nova',
ADD COLUMN     "widgetWelcomeMessage" TEXT NOT NULL DEFAULT 'Hola 👋 ¿En qué podemos ayudarte?';

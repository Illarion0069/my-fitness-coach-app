import { ShoppingBag } from 'lucide-react';

/**
 * ShopSection — placeholder for the upcoming online product.
 * Replace the content below with the actual product page once the description is ready.
 * Visibility is controlled by SHOP_PUBLIC in src/config/features.ts and isTrainer in Index.tsx.
 */
const ShopSection = () => {
  return (
    <section className="min-h-screen bg-background px-5 pt-8 pb-28">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shop</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Trainer preview</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6 space-y-3">
          <h2 className="text-lg font-semibold">Online product — coming soon</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Это тестовый раздел, виден только тебе. Сюда добавим описание и оплату онлайн-продукта.
            Когда будет готово — переключи флаг <code className="px-1 py-0.5 rounded bg-muted text-foreground">SHOP_PUBLIC</code> в{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-foreground">src/config/features.ts</code> на <code className="px-1 py-0.5 rounded bg-muted text-foreground">true</code>,
            и раздел станет доступен всем.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ShopSection;

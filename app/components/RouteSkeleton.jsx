/* eslint-disable react/prop-types */
// Skeleton mínimo por ruta destino para mostrar mientras corre el loader de
// otra pestaña. El truco: `useNavigation()` nos da `location.pathname` del
// destino antes de que React Router cambie de ruta. Pintamos el esqueleto
// adecuado y, cuando el loader termina, React Router monta la ruta real.
//
// Esto convierte el "pantalla vieja congelada" en "navegación instantánea
// con esqueleto coherente". Solo se activa cuando navigation.state === "loading".

function SkeletonBox({ height = "1.2rem", width = "100%" }) {
  return (
    <s-box
      padding="tight"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
      // eslint-disable-next-line react/no-unknown-property
      style={{ height, width, opacity: 0.5 }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <s-page heading="SEO Analyzer">
      <s-section heading="Overall store score">
        <s-stack direction="block" gap="base">
          <SkeletonBox height="2.5rem" width="40%" />
          <SkeletonBox width="60%" />
          <s-stack direction="inline" gap="base">
            <SkeletonBox height="2rem" width="180px" />
            <SkeletonBox height="2rem" width="140px" />
          </s-stack>
        </s-stack>
      </s-section>
      <s-section heading="Issues found">
        <s-stack direction="inline" gap="large">
          <SkeletonBox height="4rem" width="120px" />
          <SkeletonBox height="4rem" width="120px" />
          <SkeletonBox height="4rem" width="120px" />
        </s-stack>
      </s-section>
    </s-page>
  );
}

function ProductsSkeleton() {
  return (
    <s-page heading="Products">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <SkeletonBox height="2.2rem" width="240px" />
            <SkeletonBox height="2.2rem" width="180px" />
          </s-stack>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBox key={i} height="3rem" />
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

function IssuesSkeleton() {
  return (
    <s-page heading="Issues">
      {Array.from({ length: 3 }).map((_, i) => (
        <s-section key={i} heading="…">
          <s-stack direction="block" gap="tight">
            <SkeletonBox width="40%" />
            <SkeletonBox width="80%" />
            <SkeletonBox height="2.5rem" />
          </s-stack>
        </s-section>
      ))}
    </s-page>
  );
}

function ProductDetailSkeleton() {
  return (
    <s-page heading="Product">
      <s-section heading="SEO summary">
        <s-stack direction="inline" gap="large" alignment="center">
          <SkeletonBox height="120px" width="120px" />
          <s-stack direction="block" gap="tight">
            <SkeletonBox height="2rem" width="120px" />
            <SkeletonBox width="200px" />
          </s-stack>
        </s-stack>
      </s-section>
      <s-section heading="Issues to fix">
        <s-stack direction="block" gap="tight">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBox key={i} height="4rem" />
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

// Devuelve el esqueleto correcto según el path destino. Si no matchea ningún
// patrón conocido, devuelve null para no entorpecer.
export function RouteSkeleton({ path }) {
  if (!path) return null;
  if (path === "/app" || path === "/app/") return <DashboardSkeleton />;
  if (path.startsWith("/app/products/")) return <ProductDetailSkeleton />;
  if (path === "/app/products") return <ProductsSkeleton />;
  if (path === "/app/issues") return <IssuesSkeleton />;
  return null;
}

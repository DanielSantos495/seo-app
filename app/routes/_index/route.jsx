import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Cury SEO</h1>
        <p className={styles.text}>
          Audit the on-page SEO fields of every product in your Shopify
          store, surface what needs attention, and fix missing image alt
          texts in bulk.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Catalog-wide audit</strong>. Detect missing or
            out-of-range meta titles, meta descriptions, image alt texts,
            product descriptions and URL handles across every product.
          </li>
          <li>
            <strong>Bulk alt text fix</strong>. Generate and apply alt
            text to images that don&apos;t have it across the whole
            catalog in one click.
          </li>
          <li>
            <strong>CSV export</strong>. Download the full audit with
            each product&apos;s completeness score, issues by severity,
            and the fields that need attention.
          </li>
        </ul>
      </div>
    </div>
  );
}

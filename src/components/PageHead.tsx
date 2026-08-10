import { Helmet } from "react-helmet-async";

const SITE_URL = "https://limassol-fitness.com";

interface PageHeadProps {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

const PageHead = ({ title, description, path, noIndex }: PageHeadProps) => {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </Helmet>
  );
};

export default PageHead;

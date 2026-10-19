import { Footer } from './Footer';
import { Navbar } from './Navbar';

export const Layout = ({
  children,
  hideFooter = false,
  hideNavbarActions = false,
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar hideActions={hideNavbarActions} />
      <main className="flex-1 pt-20">{children}</main>
      {/* {!hideFooter && <Footer />} */}
      <Footer />
    </div>
  );
};

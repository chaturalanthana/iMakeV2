const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 900 }
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

    // 1. Go to Onboarding page
    console.log('Navigating to onboarding...');
    await page.goto('http://localhost:3000/onboarding', { waitUntil: 'networkidle2' });

    // Fill in onboarding step 1
    const rand = Math.floor(Math.random() * 100000);
    const tenantName = `Test Tenant Corp ${rand}`;
    const email = `admin_${rand}@example.com`;
    
    console.log(`Filling onboarding step 1 with tenant: ${tenantName}...`);
    await page.type('input[name="tenantName"]', tenantName);
    await page.type('input[name="address"]', '123 Enterprise St');
    
    // Submit step 1
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[name="email"]', { timeout: 3000 });
    
    console.log(`Filling onboarding step 2 with email: ${email}...`);
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', 'Password123');
    
    // Submit step 2
    await page.click('button[type="submit"]');
    
    // Wait for redirection to dashboard
    console.log('Waiting for dashboard redirection...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    console.log('On page:', page.url());

    // 2. Seed categories via client-side fetch
    console.log('Seeding categories via client-side fetch...');
    const seedResult = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const post = async (name, parentId = null) => {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, parentId })
        });
        return res.json();
      };
      
      const comp = await post('Computer');
      const acer = await post('Acer', comp.id);
      const laptops = await post('Laptops', acer.id);
      return { comp, acer, laptops };
    });
    console.log('Seeding completed:', seedResult);

    // 3. Navigate to Products page
    console.log('Navigating to products...');
    await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle2' });
    
    // Click "Add New Item"
    console.log('Clicking "Add New Item"...');
    let addItemBtn;
    for (const btn of await page.$$('button')) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Add New Item')) {
        addItemBtn = btn;
        break;
      }
    }
    
    if (addItemBtn) {
      await addItemBtn.click();
      console.log('Waiting for product modal form to load...');
      await page.waitForSelector('form', { timeout: 5000 });
      
      // Look for Select category TreeSelect button
      let selectCatBtn;
      for (const btn of await page.$$('button')) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('Select category')) {
          selectCatBtn = btn;
          break;
        }
      }
      
      if (selectCatBtn) {
        console.log('Opening Category TreeSelect dropdown...');
        await selectCatBtn.click();
        await new Promise(r => setTimeout(r, 800));
        
        // Take a screenshot of the dropdown options list
        console.log('Screenshotting open TreeSelect dropdown in modal...');
        await page.screenshot({ path: 'dropdown_open.png' });
        
        // Let's select "Laptops" (first we must expand Computer, then expand Acer)
        // Or we can search "Laptops" in search field
        console.log('Searching "Laptops" in search field...');
        const searchInputs = await page.$$('input[placeholder="Search categories..."]');
        if (searchInputs.length > 0) {
          await searchInputs[0].type('Laptops');
          await new Promise(r => setTimeout(r, 800));
          
          // Screenshot search matching state
          console.log('Screenshotting filtered search dropdown...');
          await page.screenshot({ path: 'dropdown_search_laptops.png' });
          
          // Click on the node with text "Laptops"
          console.log('Clicking "Laptops" node...');
          let laptopsNode;
          for (const div of await page.$$('div')) {
            const text = await page.evaluate(el => el.textContent, div);
            if (text === 'Laptops' || text.trim() === 'Laptops') {
              laptopsNode = div;
              break;
            }
          }
          if (laptopsNode) {
            await laptopsNode.click();
            await new Promise(r => setTimeout(r, 800));
            
            // Screenshot selected breadcrumb state
            console.log('Screenshotting selected breadcrumb badge trigger...');
            await page.screenshot({ path: 'selected_category_badge.png' });
          } else {
            console.log('Could not find Laptops node in search results.');
          }
        } else {
          console.log('Search input for categories not found.');
        }
      } else {
        console.log('Select category button not found.');
      }
    } else {
      console.log('Add New Item button not found.');
    }
    
    console.log('Done screenshots.');
    await browser.close();
  } catch (err) {
    console.error('SCRIPT FAILURE:', err.stack);
    if (browser) await browser.close();
  }
})();

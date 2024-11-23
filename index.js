// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { Builder, By, until } = require("selenium-webdriver");
const { Select } = require("selenium-webdriver/lib/select");


const app = express();
app.use(bodyParser.json());

app.post("/api/check-for-availability", async (req, res) => {
  const input = req.body.input;
  const entries = input.split("\n").map((line) => {
    const [brand, cls] = line.split(",");
    return { brand: brand.trim(), class: cls?.trim() };
  });

  const driver = await new Builder().forBrowser("chrome").build();
  const result = [];

  // ---------------------- CONSTANTS-------------------------

  const Brand_Name_Input_ClassName =
    ".b-input__input.b-input__text-input.ng-pristine.ng-valid";
  const DropDownMenuClassName = ".b-input__input.b-input__dropdown-input";
  const ClassInpuClassName =
    ".b-input__input.b-input__text-input.ng-valid.ng-dirty.ng-touche.flex";
  const DynamicSuggestionListClassName = ".suggestionList";
  const ButtonClass = "button.search.b-button--is-type_primary";
  const timeOut = 10000;
  const FirstListItemClassName = ".suggestionList > li:first-child";
  const SingleResultClass = ".flex.result.ng-star-inserted";
  //---------------------------------------------- Functions--------------------------

  const WaitUntillElementLocated = async (ElementClass, timeOut) => {
    const Element = await driver.wait(
      until.elementLocated(By.css(ElementClass)),
      timeOut
    );
    return Element;
  };

  const FindElement = async (ElementClass, inputValue) => {
    if (inputValue)
      await driver.findElement(By.css(ElementClass)).sendKeys(inputValue);
    else {
      const button = await driver.findElement(By.css(ElementClass));
      await driver.executeScript("arguments[0].scrollIntoView(true);", button);
      await driver.sleep(500); // Optional: wait for animations
      await button.click();
    }
  };

  const EnterInput = async (inputValue, ElementClass, timeOut) => {
    await driver.wait(until.elementLocated(By.css(ElementClass)), timeOut);

    await FindElement(ElementClass, inputValue);
  };

  const ClickButton = async (ElementClass, timeOut) => {
    await driver.wait(until.elementLocated(By.css(ElementClass)), timeOut);
    await FindElement(ElementClass);
  };

  function containsRegistered(array) {
    return array.some((element) => element.includes("Registered"));
  }

  try {
    for (const { brand, class: cls } of entries) {
      await driver.get("https://branddb.wipo.int/en/similarname/");

      EnterInput(brand, Brand_Name_Input_ClassName, timeOut);

      const dropdownElement = await WaitUntillElementLocated(
        DropDownMenuClassName,
        timeOut
      );

      const select = new Select(dropdownElement);

      await select.selectByIndex(2);

      const classInputs = await driver.wait(
        until.elementsLocated(By.css(ClassInpuClassName)),
        timeOut
      );

      await classInputs[2].sendKeys(cls);

      await driver.executeScript(
        "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
        classInputs[2]
      );

      const suggestionList = await WaitUntillElementLocated(
        DynamicSuggestionListClassName,
        timeOut
      );

      await driver.executeScript('arguments[0].scrollIntoView(true);', suggestionList);
      
      await driver.wait(until.elementIsVisible(suggestionList), 10000);

      const firstListItem = await WaitUntillElementLocated(
        FirstListItemClassName,
        timeOut
      );

      await driver.wait(until.elementIsVisible(firstListItem), 10000);

      await firstListItem.click();

      await ClickButton(ButtonClass, timeOut);

      await WaitUntillElementLocated(SingleResultClass, timeOut)
        .then(async () => {
          const results = await driver.findElements(By.css(SingleResultClass));
          console.log("Results", results.length);

          if (results.length === 0) {
            console.log(`${brand} in class ${cls}: NOT AVAILABLE`);
            console.log(results.length);
            return;
          }

          const textArray = [];

          for (let i = 0; i < results.length; i++) {
            // Scroll the element into view to trigger lazy loading
            await driver.executeScript(
              "arguments[0].scrollIntoView(true);",
              results[i]
            );

            // Allow some time for the content to load
            await driver.sleep(1000); // Adjust the sleep time as needed based on loading speed

            // Extract the text after the content has loaded
            const text = await results[i].getText();
            textArray.push(text.trim() !== "" ? text : "No content");
          }

          // console.log(textArray);

          result.push(containsRegistered(textArray));
          console.log(result);
        })
        .catch(() => {
          result[result.length] = false;
          console.log(result);
        });
    }
    res.json({ result: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred" });
  } finally {
    // await driver.quit();
  }
});

app.get("https://brand-name-checker-backend.onrender.com", async (req, res) => {
  res.send('Hello, World!');
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});

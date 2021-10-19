using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace WatchIt.API.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BaseApiController : Controller
    {
        public IMediator Mediator { get; set; }

        public BaseApiController(IMediator mediator)
        {
            this.Mediator = mediator;
        }
    }
}

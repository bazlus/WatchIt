namespace WatchIt.Application.Queries.FetchAllMovies;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using WatchIt.Domain;

internal class FetchAllMoviesRequest : IRequest<FetchAllMoviesResponse>
{
    internal class FetchAllMoviesHandler : IRequestHandler<FetchAllMoviesRequest, FetchAllMoviesResponse>
    {
        private readonly ApplicationDbContext dbContext;

        public FetchAllMoviesHandler(ApplicationDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public Task<FetchAllMoviesResponse> Handle(FetchAllMoviesRequest request, CancellationToken cancellationToken)
        {

            this.dbContext.Movies;
        }
    }
}
